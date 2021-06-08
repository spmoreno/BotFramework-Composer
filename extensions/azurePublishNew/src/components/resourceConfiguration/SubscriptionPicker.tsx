// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Subscription } from '@azure/arm-subscriptions/esm/models';
import React, { useEffect, useState } from 'react';
import formatMessage from 'format-message';

import { AutoComplete, IAutoCompleteProps } from '../shared/autoComplete/AutoComplete';
import { getSubscriptions } from '../../api';

type Props = {
  allowCreation?: boolean;
  canRefresh?: boolean;
  accessToken: string;
  onSubscriptionChange: React.Dispatch<React.SetStateAction<string>>;
} & Omit<IAutoCompleteProps, 'items' | 'onSubmit'>;

const messages = {
  placeholder: formatMessage('Select subscription'),
  subscriptionListEmpty: formatMessage(
    'Your subscription list is empty, please add your subscription, or login with another account.'
  ),
};
export const SubscriptionPicker = React.memo((props: Props) => {
  const { accessToken } = props;
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  useEffect(() => {
    if (accessToken) {
      setErrorMessage(undefined);
      setIsLoading(true);
      getSubscriptions(accessToken)
        .then((data) => {
          setIsLoading(false);
          setSubscriptions(data);
          if (data.length === 0) {
            setErrorMessage(messages.subscriptionListEmpty);
          }
        })
        .catch((err) => {
          setIsLoading(false);
          setErrorMessage(err.message);
        });
    }
  }, [accessToken]);

  const localTextFieldProps = { placeholder: messages.placeholder };
  const getValue = () => {
    return subscriptions.find((sub) => sub.subscriptionId === props.value)?.displayName;
  };
  return (
    <AutoComplete
      errorMessage={errorMessage}
      isLoading={isLoading}
      items={subscriptions.map((t) => ({ key: t.subscriptionId, text: t.displayName }))}
      onSubmit={(option) => props.onSubscriptionChange(option.key as string)}
      {...{ ...props, textFieldProps: { ...localTextFieldProps, ...props.textFieldProps }, value: getValue() }}
    />
  );
});
