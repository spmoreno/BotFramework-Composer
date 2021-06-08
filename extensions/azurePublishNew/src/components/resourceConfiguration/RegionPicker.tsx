// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { DeployLocation } from '@botframework-composer/types';
import React, { useEffect, useState } from 'react';
import { IComboBoxProps, ComboBox } from 'office-ui-fabric-react';

type Props = {
  allowCreation?: boolean;
  canRefresh?: boolean;
  tenantId: string;
  onRegionChange: React.Dispatch<React.SetStateAction<string>>;
} & Omit<IComboBoxProps, 'options'>;

export const RegionPicker = React.memo((props: Props) => {
  const [subscriptions, setSubscriptions] = useState<DeployLocation[]>();
  useEffect(() => {
    setSubscriptions([]);
  }, [props.tenantId]);
  return (
    <ComboBox
      autoComplete="on"
      options={subscriptions.map((t) => ({ key: t.id, text: t.displayName }))}
      placeholder="Select one"
      onChange={(event, option) => props.onRegionChange(option.id)}
      {...props}
    />
  );
});
