// Copyright (c) RoochNetwork
// SPDX-License-Identifier: Apache-2.0

use anyhow::Error;
use clap::Parser;
use metrics::RegistryService;
use moveos_types::moveos_std::object::ObjectMeta;
use rooch_config::{RoochOpt, R_OPT_NET_HELP};
use rooch_db::RoochDB;
use rooch_genesis::RoochGenesis;
use rooch_types::error::{RoochError, RoochResult};
use rooch_types::rooch_network::RoochChainID;
use std::path::PathBuf;
use std::time::SystemTime;

use crate::cli_types::WalletContextOptions;

/// Revert tx by db command.
#[derive(Debug, Parser)]
pub struct RevertTxCommand {
    #[clap(long, short = 'o')]
    /// tx order
    pub tx_order: u64,

    #[clap(long = "data-dir", short = 'd')]
    /// Path to data dir, this dir is base dir, the final data_dir is base_dir/chain_network_name
    pub base_data_dir: Option<PathBuf>,

    /// If local chainid, start the service with a temporary data store.
    /// All data will be deleted when the service is stopped.
    #[clap(long, short = 'n', help = R_OPT_NET_HELP)]
    pub chain_id: Option<RoochChainID>,

    #[clap(flatten)]
    pub context_options: WalletContextOptions,
}

impl RevertTxCommand {
    pub async fn execute(self) -> RoochResult<()> {
        let tx_order = self.tx_order;
        let (_root, rooch_db, _start_time) = self.init();

        let tx_hashes = rooch_db
            .rooch_store
            .transaction_store
            .get_tx_hashes(vec![tx_order])?;

        // check tx hash exist via tx_order
        if tx_hashes.is_empty() || tx_hashes[0].is_none() {
            return Err(RoochError::from(Error::msg(format!(
                "tx hash not exist via tx order {}",
                tx_order
            ))));
        }
        let tx_hash = tx_hashes[0].unwrap();

        rooch_db.revert_tx(tx_hash)?;

        Ok(())
    }

    fn init(self) -> (ObjectMeta, RoochDB, SystemTime) {
        let start_time = SystemTime::now();

        let opt = RoochOpt::new_with_default(self.base_data_dir, self.chain_id, None).unwrap();
        let registry_service = RegistryService::default();
        let rooch_db =
            RoochDB::init(opt.store_config(), &registry_service.default_registry()).unwrap();
        let genesis = RoochGenesis::load_or_init(opt.network(), &rooch_db).unwrap();
        let root = genesis.genesis_root().clone();
        (root, rooch_db, start_time)
    }
}
