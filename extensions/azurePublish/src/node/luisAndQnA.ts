// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as path from 'path';

import * as fs from 'fs-extra';
import * as rp from 'request-promise';
import { isUsingAdaptiveRuntime } from '@bfc/shared';
import { ILuisConfig, FileInfo, IBotProject, RuntimeTemplate, DialogSetting } from '@botframework-composer/types';

import { AzurePublishErrors } from './utils/errorHandler';
import { BotProjectDeployLoggerType } from './types';


const botPath = (projPath: string, runtime?: DialogSetting['runtime']) =>
  isUsingAdaptiveRuntime(runtime) ? projPath : path.join(projPath, 'ComposerDialogs');

type QnaConfigType = {
  subscriptionKey: string;
  qnaRegion: string | 'westus';
};

type Resource = { id: string; isEmpty: boolean };

type Resources = {
  luResources: Resource[];
  qnaResources: Resource[];
};

interface BuildSettingType {
  luis: ILuisConfig;
  qna: QnaConfigType;
  luResources: Resource[];
  qnaResources: Resource[];
  runtime?: DialogSetting['runtime'];
}

function getAccount(accounts: any, filter: string) {
  for (const account of accounts) {
    if (account.AccountName === filter) {
      return account;
    }
  }
}

/**
 * return an array of all the files in a given directory
 * @param dir
 */
async function getFiles(dir: string): Promise<string[]> {
  const files = [];

  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const dirents = await fs.readdir(dir, { withFileTypes: true });

  for (const dirent of dirents) {
    const res = path.resolve(dir, dirent.name);

    if (dirent.isDirectory()) {
      files.push(...(await getFiles(res)));
    } else {
      files.push(res);
    }
  }

  return files;
}

export async function publishLuisToPrediction(
  name: string,
  environment: string,
  accessToken: string,
  luisSettings: ILuisConfig,
  luisResource: string,
  path: string,
  logger,
  runtime?: RuntimeTemplate
) {
  let {
    // eslint-disable-next-line prefer-const
    authoringKey: luisAuthoringKey,
    authoringEndpoint: authoringEndpoint,
    authoringRegion: luisAuthoringRegion,
  } = luisSettings;

  if (!luisAuthoringRegion) {
    luisAuthoringRegion = luisSettings.region || 'westus';
  }
  if (!authoringEndpoint) {
    authoringEndpoint = `https://${luisAuthoringRegion}.api.cognitive.microsoft.com`;
  }

  // Find any files that contain the name 'luis.settings' in them
  // These are generated by the LuBuild process and placed in the generated folder
  // These contain dialog-to-luis app id mapping
  const luisConfigFiles = (await getFiles(botPath(path, runtime))).filter((filename) =>
    filename.includes('luis.settings')
  );
  const luisAppIds: any = {};

  // Read in all the luis app id mappings
  for (const luisConfigFile of luisConfigFiles) {
    const luisSettings = await fs.readJson(luisConfigFile);
    Object.assign(luisAppIds, luisSettings.luis);
  }

  if (!Object.keys(luisAppIds).length) return luisAppIds;
  logger({
    status: BotProjectDeployLoggerType.DEPLOY_INFO,
    message: 'start publish luis',
  });

  // In order for the bot to use the LUIS models, we need to assign a LUIS key to the endpoint of each app
  // First step is to get a list of all the accounts available based on the given luisAuthoringKey.
  let accountList;

  // Retry twice here
  let retryCount = 0;
  while (retryCount < 2) {
    try {
      // Make a call to the azureaccounts api
      // DOCS HERE: https://westus.dev.cognitive.microsoft.com/docs/services/5890b47c39e2bb17b84a55ff/operations/5be313cec181ae720aa2b26c
      // This returns a list of azure account information objects with AzureSubscriptionID, ResourceGroup, AccountName for each.
      const getAccountUri = `${authoringEndpoint}/luis/api/v2.0/azureaccounts`;
      const options = {
        headers: { Authorization: `Bearer ${accessToken}`, 'Ocp-Apim-Subscription-Key': luisAuthoringKey },
      } as rp.RequestPromiseOptions;
      const response = await rp.get(getAccountUri, options);

      // this should include an array of account info objects
      accountList = JSON.parse(response);
      break;
    } catch (err) {
      if (retryCount < 1) {
        logger({
          status: AzurePublishErrors.LUIS_PUBLISH_ERROR,
          message: JSON.stringify(err, Object.getOwnPropertyNames(err)),
        });
        retryCount++;
      } else {
        // handle the token invalid
        const error = JSON.parse(err.error);
        if (error?.error?.message && error?.error?.message.indexOf('access token expiry') > 0) {
          throw new Error(
            `Type: ${error?.error?.code}, Message: ${error?.error?.message}, run az account get-access-token, then replace the accessToken in your configuration`
          );
        } else {
          throw err;
        }
      }
    }
  }

  // Extract the account object that matches the expected resource name.
  // This is the name that would appear in the azure portal associated with the luis endpoint key.
  const account = getAccount(accountList, luisResource ? luisResource : `${name}-${environment}-luis`);

  // Assign the appropriate account to each of the applicable LUIS apps for this bot.
  // DOCS HERE: https://westus.dev.cognitive.microsoft.com/docs/services/5890b47c39e2bb17b84a55ff/operations/5be32228e8473de116325515
  for (const dialogKey in luisAppIds) {
    const luisAppId = luisAppIds[dialogKey].appId;
    logger({
      status: BotProjectDeployLoggerType.DEPLOY_INFO,
      message: `Assigning to luis app id: ${luisAppId}`,
    });

    // Retry at most twice for each api call
    let retryCount = 0;
    while (retryCount < 2) {
      try {
        const luisAssignEndpoint = `${authoringEndpoint}/luis/api/v2.0/apps/${luisAppId}/azureaccounts`;
        const options = {
          body: account,
          json: true,
          headers: { Authorization: `Bearer ${accessToken}`, 'Ocp-Apim-Subscription-Key': luisAuthoringKey },
        } as rp.RequestPromiseOptions;
        await rp.post(luisAssignEndpoint, options);

        break;
      } catch (err) {
        if (retryCount < 1) {
          logger({
            status: AzurePublishErrors.LUIS_PUBLISH_ERROR,
            message: JSON.stringify(err, Object.getOwnPropertyNames(err), 2),
          });
          retryCount++;
        } else {
          // handle the token invalid
          // handle the token invalid
          if (typeof err.error === 'string') {
            const error = JSON.parse(err.error);
            if (error?.error?.message && error?.error?.message.indexOf('access token expiry') > 0) {
              throw new Error(
                `Type: ${error?.error?.code}, Message: ${error?.error?.message}, run az account get-access-token, then replace the accessToken in your configuration`
              );
            }
          }
          throw Error(
            'Failed to bind luis prediction resource to luis applications. Please check if your luisResource is set to luis prediction service name in your publish profile.'
          );
        }
      }
    }
  }

  // The process has now completed.
  logger({
    status: BotProjectDeployLoggerType.DEPLOY_INFO,
    message: 'Luis Publish Success! ...',
  });

  // return the new settings that need to be added to the main settings file.
  return luisAppIds;
}

export async function build(project: IBotProject, path: string, settings: BuildSettingType) {
  const { luResources, qnaResources, luis: luisConfig, qna: qnaConfig } = settings;

  const { builder, files } = project;

  const luFiles: FileInfo[] = [];
  const emptyFiles = {};
  luResources.forEach(({ id, isEmpty }) => {
    const fileName = `${id}.lu`;
    const f = files.get(fileName);
    if (isEmpty) emptyFiles[fileName] = true;
    if (f) {
      luFiles.push(f);
    }
  });
  const qnaFiles: FileInfo[] = [];
  qnaResources.forEach(({ id, isEmpty }) => {
    const fileName = `${id}.qna`;
    const f = files.get(fileName);
    if (isEmpty) emptyFiles[fileName] = true;
    if (f) {
      qnaFiles.push(f);
    }
  });

  builder.rootDir = botPath(path, settings?.runtime);
  builder.setBuildConfig({ ...luisConfig, ...qnaConfig }, project.settings.downsampling);
  await builder.build(luFiles, qnaFiles, Array.from(files.values()) as FileInfo[], emptyFiles);
  await builder.copyModelPathToBot(isUsingAdaptiveRuntime(settings?.runtime));
}
