// Copyright (c) RoochNetwork
// SPDX-License-Identifier: Apache-2.0

use crate::client_config::{ClientConfig, DEFAULT_EXPIRATION_SECS};
use crate::Client;
use anyhow::anyhow;
use move_core_types::account_address::AccountAddress;
use moveos_types::gas_config::GasConfig;
use moveos_types::transaction::MoveAction;
use rooch_config::config::{Config, PersistedConfig};
use rooch_config::{rooch_config_dir, ROOCH_CLIENT_CONFIG};
use rooch_key::keystore::AccountKeystore;
use rooch_rpc_api::jsonrpc_types::{ExecuteTransactionResponseView, KeptVMStatusView};
use rooch_types::address::RoochAddress;
use rooch_types::coin_type::CoinID;
use rooch_types::crypto::Signature;
use rooch_types::error::{RoochError, RoochResult};
use rooch_types::transaction::{
    authenticator::Authenticator,
    rooch::{RoochTransaction, RoochTransactionData},
};
use std::collections::BTreeMap;
use std::path::PathBuf;
use std::str::FromStr;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;

pub struct WalletContext {
    client: Arc<RwLock<Option<Client>>>,
    pub config: PersistedConfig<ClientConfig>,
}

impl WalletContext {
    pub async fn new(config_path: Option<PathBuf>) -> Result<Self, anyhow::Error> {
        let config_dir = config_path.unwrap_or(rooch_config_dir()?);
        let config_path = config_dir.join(ROOCH_CLIENT_CONFIG);
        let config: ClientConfig = PersistedConfig::read(&config_path).map_err(|err| {
            anyhow!(
                "Cannot open wallet config file at {:?}. Err: {err}, Use `rooch init` to configuration",
                config_path
            )
        })?;

        let config = config.persisted(&config_path);
        Ok(Self {
            client: Default::default(),
            config,
        })
    }

    pub fn parse_account_arg(&self, arg: String) -> Result<AccountAddress, RoochError> {
        self.parse(arg)
    }

    pub fn parse_account_args(
        &self,
        args: BTreeMap<String, String>,
    ) -> Result<BTreeMap<String, AccountAddress>, RoochError> {
        Ok(args
            .into_iter()
            .map(|(key, value)| (key, self.parse(value).unwrap()))
            .collect())
    }

    pub async fn get_client(&self) -> Result<Client, anyhow::Error> {
        // TODO: Check version

        let read = self.client.read().await;

        Ok(if let Some(client) = read.as_ref() {
            client.clone()
        } else {
            drop(read);
            let client = self
                .config
                .get_active_env()?
                .create_rpc_client(Duration::from_secs(DEFAULT_EXPIRATION_SECS), None)
                .await?;

            self.client.write().await.insert(client).clone()
        })
    }

    pub async fn build_rooch_tx_data(
        &self,
        sender: RoochAddress,
        action: MoveAction,
    ) -> RoochResult<RoochTransactionData> {
        let client = self.get_client().await?;
        let chain_id = self.config.get_active_env()?.chain_id;
        let sequence_number = client
            .get_sequence_number(sender)
            .await
            .map_err(RoochError::from)?;
        log::debug!("use sequence_number: {}", sequence_number);
        //TODO max gas amount from cli option or dry run estimate
        let tx_data = RoochTransactionData::new(
            sender,
            sequence_number,
            chain_id,
            GasConfig::DEFAULT_MAX_GAS_AMOUNT,
            action,
        );
        Ok(tx_data)
    }

    pub async fn sign(
        &self,
        sender: RoochAddress,
        action: MoveAction,
        coin_id: CoinID,
    ) -> RoochResult<RoochTransaction> {
        let kp = self
            .config
            .keystore
            .get_key_pair_by_coin_id(&sender, coin_id)
            .ok()
            .ok_or_else(|| {
                RoochError::SignMessageError(format!("Cannot find key for address: [{sender}]"))
            })?;

        match coin_id {
            CoinID::Rooch => {
                let tx_data = self.build_rooch_tx_data(sender, action).await?;
                let signature = Signature::new_hashed(tx_data.hash().as_bytes(), kp);
                Ok(RoochTransaction::new(
                    tx_data,
                    Authenticator::rooch(signature),
                ))
            }
            CoinID::Ether => todo!(),
            CoinID::Bitcoin => todo!(),
            CoinID::Nostr => todo!(),
        }
    }

    pub async fn execute(
        &self,
        tx: RoochTransaction,
    ) -> RoochResult<ExecuteTransactionResponseView> {
        let client = self.get_client().await?;
        client
            .execute_tx(tx)
            .await
            .map_err(|e| RoochError::TransactionError(e.to_string()))
    }

    pub async fn sign_and_execute(
        &self,
        sender: RoochAddress,
        action: MoveAction,
        coin_id: CoinID,
    ) -> RoochResult<ExecuteTransactionResponseView> {
        let tx = self.sign(sender, action, coin_id).await?;
        self.execute(tx).await
    }

    fn parse(&self, account: String) -> Result<AccountAddress, RoochError> {
        if account.starts_with("0x") {
            AccountAddress::from_hex_literal(&account).map_err(|err| {
                RoochError::CommandArgumentError(format!("Failed to parse AccountAddress {}", err))
            })
        } else if let Ok(account_address) = AccountAddress::from_str(&account) {
            Ok(account_address)
        } else {
            let address = match account.as_str() {
                "default" => AccountAddress::from(self.config.active_address.unwrap()),
                _ => Err(RoochError::CommandArgumentError(
                    "Use rooch init configuration".to_owned(),
                ))?,
            };

            Ok(address)
        }
    }

    pub fn assert_execute_success(
        &self,
        result: ExecuteTransactionResponseView,
    ) -> RoochResult<ExecuteTransactionResponseView> {
        if KeptVMStatusView::Executed != result.execution_info.status {
            Err(RoochError::TransactionError(format!(
                "Transaction execution failed: {:?}",
                result.execution_info.status
            )))
        } else {
            Ok(result)
        }
    }
}
