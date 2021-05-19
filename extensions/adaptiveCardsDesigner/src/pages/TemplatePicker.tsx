// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/** @jsx jsx */
import styled from '@emotion/styled';
import { jsx } from '@emotion/core';
import React, { useCallback, useMemo } from 'react';
import { Dropdown, IDropdownOption } from 'office-ui-fabric-react/lib/Dropdown';
import { Label } from 'office-ui-fabric-react/lib/Label';
import { Stack } from 'office-ui-fabric-react/lib/Stack';
import { TextField } from 'office-ui-fabric-react/lib/TextField';
import formatMessage from 'format-message';
import { LgFile } from '@botframework-composer/types';

import { TemplateList } from './TemplateList';
import { AdaptiveCardRenderer } from './AdaptiveCardRenderer';
import { Mode, ParsedLgTemplate } from './types';

const Container = styled.div({
  paddingTop: '8px',
});

type Props = {
  lgFiles: LgFile[];
  templates: ParsedLgTemplate[];
  mode: Mode;
  templateName?: string;
  selectedLgFileId: string;
  selectedTemplate?: ParsedLgTemplate;
  onLgFileChanged: (file: LgFile) => void;
  onTemplateNameChanged: (templateName: string) => void;
  onTemplateUpdated: (template: ParsedLgTemplate) => void;
};

export const TemplatePicker: React.FC<Props> = ({
  lgFiles,
  templates,
  mode,
  selectedLgFileId,
  selectedTemplate,
  templateName = '',
  onLgFileChanged,
  onTemplateNameChanged,
  onTemplateUpdated,
}) => {
  const lgFileOptions = useMemo(() => {
    return lgFiles.map((file) => ({
      key: file.id,
      text: file.id,
      data: {
        file,
      },
    }));
  }, [lgFiles]);

  const onDropdownChange = useCallback(
    (_, option?: IDropdownOption) => {
      if (option.key) {
        onLgFileChanged(option.data.file);
      }
    },
    [onLgFileChanged]
  );

  const onChange = useCallback(
    (_, name = '') => {
      onTemplateNameChanged(name);
    },
    [onTemplateNameChanged]
  );

  return (
    <Container>
      <Stack horizontal horizontalAlign="space-between">
        <Stack>
          <Label required>{formatMessage('Lg file')}</Label>
          <Dropdown defaultSelectedKey={selectedLgFileId} options={lgFileOptions} onChange={onDropdownChange} />
          {mode === 'create' && (
            <React.Fragment>
              <Label required>{formatMessage('Template name')}</Label>
              <TextField value={templateName} onChange={onChange} />
            </React.Fragment>
          )}
          <TemplateList mode={mode} templates={templates} onTemplateSelected={onTemplateUpdated} />
        </Stack>
        <AdaptiveCardRenderer card={selectedTemplate?.body} />
      </Stack>
    </Container>
  );
};