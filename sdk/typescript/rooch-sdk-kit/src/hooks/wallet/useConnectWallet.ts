// Copyright (c) RoochNetwork
// SPDX-License-Identifier: Apache-2.0

import type { UseMutationOptions, UseMutationResult } from '@tanstack/react-query'
import { useMutation } from '@tanstack/react-query'
import { ThirdPartyAddress } from '@roochnetwork/rooch-sdk'

import { useWalletStore } from './useWalletStore.js'
import { walletMutationKeys } from '../../constants/index.js'
import { Wallet } from '../../wellet/index.js'

type ConnectWalletArgs = {
  wallet: Wallet
}
type ConnectWalletResult = ThirdPartyAddress[]

type UseConnectWalletMutationOptions = Omit<
  UseMutationOptions<ConnectWalletResult, Error, ConnectWalletArgs, unknown>,
  'mutationFn'
>

/**
 * Mutation hook for establishing a connection to a specific wallet.
 *
 */
export function useConnectWallet({
  mutationKey,
  ...mutationOptions
}: UseConnectWalletMutationOptions = {}): UseMutationResult<
  ConnectWalletResult,
  Error,
  ConnectWalletArgs,
  unknown
> {
  const setWalletConnected = useWalletStore((state) => state.setWalletConnected)
  const setConnectionStatus = useWalletStore((state) => state.setConnectionStatus)

  return useMutation({
    mutationKey: walletMutationKeys.connectWallet(mutationKey),
    mutationFn: async ({ wallet }) => {
      try {
        setConnectionStatus('connecting')

        const connectAddress = await wallet.connect()
        const selectedAddress = connectAddress[0]

        setWalletConnected(wallet, connectAddress, selectedAddress)

        return connectAddress
      } catch (error) {
        setConnectionStatus('disconnected')
        throw error
      }
    },
    ...mutationOptions,
  })
}
