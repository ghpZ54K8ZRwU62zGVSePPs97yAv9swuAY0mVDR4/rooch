import { useMemo } from 'react';

import { LoadingButton } from '@mui/lab';
import { Alert, Stack, CircularProgress } from '@mui/material';

import { grey } from 'src/theme/core';

import SwapHeader from './swap-header';
import SwapDetails from './swap-details';
import { DEFAULT_SLIPPAGE } from './types';
import SwapCoinInput from './swap-coin-input';
import SwapSwitchIcon from './swap-switch-icon';
import CurveTypeSelect from './curve-type-select';
import { useNetworkVariable } from '../../hooks/use-networks';

import type { SwapProps } from './types';

export default function Swap({
  loading,
  availableFromCoins,
  availableToCoins,
  fromCoin,
  toCoin,
  interactiveMode,
  canSelectCurve,
  swapAmount,
  convertRate,
  slippagePercent = DEFAULT_SLIPPAGE,
  slippageAmount,
  platformFeePercent,
  platformFeeAmount,
  priceImpact,
  priceImpactSeverity,
  curve,
  warning,
  validationError,
  canSelectVersion,
  version,
  fixedSwap,
  hiddenValue,
  txHash,
  gasInfo,
  simulationStatus,
  simulationError,
  proposing,
  isValid,
  swapHeaderTitle,
  containerProps,
  easyMode,
  onSlippageChange,
  onCurveTypeChange,
  onVersionChange,
  onSwitch,
  onSwap,
  onPreview,
  onPropose,
}: SwapProps) {
  const disabledCoins: string[] = useMemo(
    () => [fromCoin?.coin_type || '', toCoin?.coin_type || ''],
    [fromCoin?.coin_type, toCoin?.coin_type]
  );
  const { memPool } = useNetworkVariable('gasMarket');

  const showDetails = useMemo(
    () =>
      !!(
        fromCoin?.coin_type &&
        fromCoin?.amount &&
        toCoin?.coin_type &&
        toCoin?.amount &&
        interactiveMode
      ),
    [fromCoin?.coin_type, fromCoin?.amount, toCoin?.coin_type, toCoin?.amount, interactiveMode]
  );

  const proposeButtonContent: { text: string; disabled?: boolean } = useMemo(() => {
    if (validationError) {
      return {
        text: validationError,
        disabled: true,
      };
    }

    if ((Number(fromCoin?.amount) || 0) > (Number(fromCoin?.balance) || 0)) {
      return {
        text: 'Insufficient balance',
        disabled: true,
      };
    }

    if (slippagePercent <= 0 || slippagePercent > 0.5) {
      return {
        text: 'Invalid slippage',
        disabled: true,
      };
    }

    if (showDetails) {
      return {
        text: 'Submit',
      };
    }
    return {
      text: 'Submit',
      disabled: true,
    };
  }, [validationError, fromCoin?.amount, fromCoin?.balance, slippagePercent, showDetails]);

  const sortedBalanceAvailableFromCoins = useMemo(
    () =>
      availableFromCoins.sort((a, b) => {
        if (Number(a.balance) === 0) {
          return 1;
        }
        return -1;
      }),
    [availableFromCoins]
  );

  const sortedBalanceAvailableToCoins = useMemo(
    () =>
      availableToCoins.sort((a, b) => {
        if (Number(a.balance) === 0) {
          return 1;
        }
        return -1;
      }),
    [availableToCoins]
  );

  return (
    <Stack
      direction="column"
      {...containerProps}
      sx={{
        border: `1px solid ${grey[200]}`,
        borderRadius: '16px',
        boxShadow: '0px 5px 40px 0px rgba(16, 16, 40, 0.10)',
        ...containerProps?.sx,
      }}
    >
      <SwapHeader
        fixedSwap={fixedSwap}
        slippage={slippagePercent}
        onSlippageChange={onSlippageChange}
        header={swapHeaderTitle}
      />
      <Stack spacing={3} padding={4}>
        <Stack spacing={-1} alignItems="center">
          <SwapCoinInput
            hiddenValue={hiddenValue}
            fixedSwap={fixedSwap}
            coins={sortedBalanceAvailableFromCoins}
            coin={fromCoin}
            type="from"
            interactiveMode={interactiveMode}
            disabledCoins={disabledCoins}
            onChange={(coin, source) => {
              console.log('🚀 ~ swap.tsx:159 ~ coin:', coin);
              onSwap({
                fromCoin: coin,
                toCoin,
                interactiveMode: source === 'amount' ? 'from' : 'to',
              });
            }}
          />
          <SwapSwitchIcon onClick={onSwitch} />
          <SwapCoinInput
            hiddenValue={hiddenValue}
            fixedSwap={fixedSwap}
            coins={sortedBalanceAvailableToCoins}
            coin={toCoin}
            type="to"
            easyMode={easyMode}
            interactiveMode={interactiveMode}
            disabledCoins={disabledCoins}
            onChange={async (coin, source) => {
              await onSwap({
                fromCoin,
                toCoin: coin,
                interactiveMode: source === 'amount' ? 'to' : 'from',
              });
            }}
          />
        </Stack>

        {warning &&
          (typeof warning === 'string' ? (
            <Alert color="warning" severity="error">
              {warning}
            </Alert>
          ) : (
            warning
          ))}

        {canSelectCurve && curve && (
          <CurveTypeSelect curveType={curve} onChange={onCurveTypeChange} />
        )}
        {showDetails && (
          <SwapDetails
            loading={loading}
            fromCoin={fromCoin}
            toCoin={toCoin}
            interactiveMode={interactiveMode}
            swapAmount={swapAmount}
            slippagePercent={slippagePercent}
            slippageAmount={slippageAmount}
            platformFeePercent={platformFeePercent}
            platformFeeAmount={platformFeeAmount}
            convertRate={convertRate}
            priceImpact={priceImpact}
            priceImpactSeverity={priceImpactSeverity}
            canSelectCurve={canSelectCurve}
            curve={curve}
            canSelectVersion={canSelectVersion}
            version={version}
            easyMode={easyMode}
            fixedSwap={fixedSwap}
            variant="propose"
            onVersionChange={onVersionChange}
          />
        )}
        <LoadingButton
          variant="contained"
          loading={proposing}
          disabled={proposeButtonContent.disabled || !isValid}
          sx={{
            height: '52px',
          }}
          onClick={() => {
            onPreview();
          }}
        >
          {isValid ? proposeButtonContent.text : 'network invalid'}
        </LoadingButton>
        {txHash && (
          <Stack>
            <Stack
              className="text-sm font-semibold"
              direction="row"
              spacing={1}
              alignItems="center"
            >
              Transaction has been submitted, awaiting confirmation
              <CircularProgress variant="indeterminate" color="secondary" size={16} />
            </Stack>
            <Stack
              className="text-sm font-semibold"
              direction="row"
              spacing={0.5}
              alignItems="center"
            >
              check in the{' '}
              <a href={memPool + txHash} target="_blank" rel="noreferrer">
                mempool.space
              </a>
            </Stack>
          </Stack>
        )}
      </Stack>
      {/* <SwapPreviewModal
        open={openPreview}
        onClose={() => setOpenPreview(false)}
        fromCoin={fromCoin}
        toCoin={toCoin}
        interactiveMode={interactiveMode}
        swapAmount={swapAmount}
        slippagePercent={slippagePercent}
        slippageAmount={slippageAmount}
        platformFeePercent={platformFeePercent}
        platformFeeAmount={platformFeeAmount}
        convertRate={convertRate}
        priceImpact={priceImpact}
        priceImpactSeverity={priceImpactSeverity}
        canSelectCurve={canSelectCurve}
        curve={curve}
        canSelectVersion={canSelectVersion}
        version={version}
        gasInfo={gasInfo}
        simulationStatus={simulationStatus}
        simulationError={simulationError}
        proposing={proposing}
        onPropose={onPropose}
      /> */}
    </Stack>
  );
}
