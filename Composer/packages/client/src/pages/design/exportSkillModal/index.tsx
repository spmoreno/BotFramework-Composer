// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/** @jsx jsx */
import { jsx } from '@emotion/core';
import React, { useRef, useState } from 'react';
import formatMessage from 'format-message';
import { Dialog, DialogFooter, DialogType } from 'office-ui-fabric-react/lib/Dialog';
import { DefaultButton, PrimaryButton } from 'office-ui-fabric-react/lib/Button';
import { JSONSchema7 } from '@bfc/extension-client';
import { Link } from 'office-ui-fabric-react/lib/components/Link';
import { useRecoilValue } from 'recoil';
import { SkillManifestFile } from '@bfc/shared';

import {
  dispatcherState,
  skillManifestsState,
  qnaFilesState,
  dialogsSelectorFamily,
  dialogSchemasState,
  luFilesState,
  currentTargetState,
} from '../../../recoilModel';

import { editorSteps, ManifestEditorSteps, order } from './constants';
import { generateSkillManifest } from './generateSkillManifest';
import { styles } from './styles';
import {
  getTenantIdFromCache,
  getTokenFromCache,
  isGetTokenFromUser,
  isShowAuthDialog,
  setTenantId,
} from '../../../utils/auth';
import { AuthClient } from '../../../utils/authClient';
import { createNotification } from '../../../recoilModel/dispatchers/notification';
import { getPendingNotificationCardProps, getPendingNotificationSkillCardProps } from '../../publish/Notifications';
import { AuthDialog } from '../../../components/Auth/AuthDialog';
import { navigate } from '@reach/router';

interface ExportSkillModalProps {
  isOpen: boolean;
  onDismiss: () => void;
  onSubmit: () => void;
  projectId: string;
}

const ExportSkillModal: React.FC<ExportSkillModalProps> = ({ onSubmit, onDismiss: handleDismiss, projectId }) => {
  const dialogs = useRecoilValue(dialogsSelectorFamily(projectId));
  const dialogSchemas = useRecoilValue(dialogSchemasState(projectId));
  const luFiles = useRecoilValue(luFilesState(projectId));
  const qnaFiles = useRecoilValue(qnaFilesState(projectId));
  const currentTarget = useRecoilValue(currentTargetState(projectId));
  const skillManifests = useRecoilValue(skillManifestsState(projectId));
  const { updateSkillManifest } = useRecoilValue(dispatcherState);
  const { publishToTarget, addNotification } = useRecoilValue(dispatcherState);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [clickPublish, setclickPublish] = useState(false);

  const [editingId, setEditingId] = useState<string>();
  const [currentStep, setCurrentStep] = useState(0);
  const [errors, setErrors] = useState({});
  const [schema, setSchema] = useState<JSONSchema7>({});

  const [skillManifest, setSkillManifest] = useState<Partial<SkillManifestFile>>({});

  const { content = {}, id } = skillManifest;

  const [selectedDialogs, setSelectedDialogs] = useState<any[]>([]);
  const [selectedTriggers, setSelectedTriggers] = useState<any[]>([]);

  const editorStep = order[currentStep];
  const { buttons = [], content: Content, editJson, helpLink, subText, title, validate } = editorSteps[editorStep];

  const handleGenerateManifest = () => {
    const manifest = generateSkillManifest(
      schema,
      skillManifest,
      dialogs,
      dialogSchemas,
      luFiles,
      qnaFiles,
      selectedTriggers,
      selectedDialogs,
      currentTarget,
      projectId
    );
    setSkillManifest(manifest);
  };

  const handleEditJson = () => {
    const step = order.findIndex((step) => step === ManifestEditorSteps.MANIFEST_REVIEW);
    if (step >= 0) {
      setCurrentStep(step);
      setErrors({});
    }
  };

  const handleTriggerPublish = async () => {
    navigate(`/bot/${projectId}/publish/all`);
    // get token
    // setShowAuthDialog(true);
    // let token = '';
    // // TODO: this logic needs to be moved into the Azure publish extensions
    // if (isGetTokenFromUser()) {
    //   token = getTokenFromCache('accessToken');
    // } else {
    //   let tenant = getTenantIdFromCache();
    //   if (!tenant) {
    //     const tenants = await AuthClient.getTenants();
    //     tenant = tenants?.[0]?.tenantId;
    //     setTenantId(tenant);
    //   }
    //   token = await AuthClient.getARMTokenForTenant(tenant);
    // }
    // // const notification = createNotification(getPendingNotificationSkillCardProps());
    // // addNotification(notification);
    // await publishToTarget(projectId, currentTarget, {}, null, token);
  };

  const handleSave = () => {
    if (skillManifest.content && skillManifest.id) {
      updateSkillManifest(skillManifest as SkillManifestFile, projectId);
    }
  };

  const handleNext = (options?: { dismiss?: boolean; id?: string; save?: boolean }) => {
    const validated =
      typeof validate === 'function' ? validate({ content, editingId, id, schema, skillManifests }) : errors;

    if (!Object.keys(validated).length) {
      setCurrentStep((current) => (current + 1 < order.length ? current + 1 : current));
      options?.save && handleSave();
      options?.id && setEditingId(options.id);
      options?.dismiss && handleDismiss();
      setErrors({});
    } else {
      setErrors(validated);
    }
  };

  return (
    <Dialog
      dialogContentProps={{
        type: DialogType.close,
        title: title(),
        styles: styles.dialog,
      }}
      hidden={false}
      modalProps={{
        isBlocking: false,
        styles: styles.modal,
      }}
      onDismiss={handleDismiss}
    >
      <div css={styles.container}>
        <p>
          {typeof subText === 'function' && subText()}
          {helpLink && (
            <React.Fragment>
              {!!subText && <React.Fragment>&nbsp;</React.Fragment>}
              <Link href={helpLink} rel="noopener noreferrer" target="_blank">
                {formatMessage('Learn more')}
              </Link>
            </React.Fragment>
          )}
        </p>
        <div css={styles.content}>
          <Content
            completeStep={handleNext}
            editJson={handleEditJson}
            errors={errors}
            manifest={skillManifest}
            projectId={projectId}
            schema={schema}
            setErrors={setErrors}
            setSchema={setSchema}
            setSelectedDialogs={setSelectedDialogs}
            setSelectedTriggers={setSelectedTriggers}
            setSkillManifest={setSkillManifest}
            skillManifests={skillManifests}
            value={content}
            onChange={(manifestContent) => setSkillManifest({ ...skillManifest, content: manifestContent })}
          />
        </div>
        <DialogFooter>
          <div css={styles.buttonContainer}>
            <div>
              {buttons.map(({ disabled, primary, text, onClick }, index) => {
                const Button = primary ? PrimaryButton : DefaultButton;
                const isDisabled = typeof disabled === 'function' ? disabled({ manifest: skillManifest }) : !!disabled;

                return (
                  <Button
                    key={index}
                    disabled={isDisabled}
                    styles={{ root: { marginLeft: '8px' } }}
                    text={text()}
                    onClick={onClick({
                      generateManifest: handleGenerateManifest,
                      setCurrentStep,
                      manifest: skillManifest,
                      onDismiss: handleDismiss,
                      onNext: handleNext,
                      onSave: handleSave,
                      onPublish: handleTriggerPublish,
                      onSubmit,
                    })}
                  />
                );
              })}
            </div>
            {editJson && <DefaultButton text={formatMessage('Edit in JSON')} onClick={handleEditJson} />}
          </div>
        </DialogFooter>
        {/* {clickPublish && isShowAuthDialog(false) && (
          <AuthDialog
            needGraph={false}
            next={() => {
              // setDialogHidden(false);
            }}
            onDismiss={() => {
              setShowAuthDialog(false);
            }}
          />
        )} */}
      </div>
    </Dialog>
  );
};

export default ExportSkillModal;
