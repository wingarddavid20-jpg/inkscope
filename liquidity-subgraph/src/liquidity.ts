import { Address, BigDecimal, BigInt } from '@graphprotocol/graph-ts';
import { BridgeTransfer, CexTransfer } from '../generated/schema';
import { Transfer as TransferEvent } from '../generated/USDC/IERC20';
import { AaveOracle } from '../generated/USDC/AaveOracle';

// --- Configuration ---------------------------------------------------------

// Bridge routers on Ink. `to` a bridge = capital leaving Ink (outbound);
// `from` a bridge = capital arriving on Ink (inbound).
const BRIDGES: Address[] = [
  Address.fromString('0xeF684C38F94F48775959ECf2012D7E864ffb9dd4'), // Across SpokePool
];

// CEX operational wallets on Ink, discovered via scripts/probe-ink-cex.mjs and
// confirmed by the user (2026-08-28). All six are EOAs with large two-way
// USDT0 churn (in ≈ out) — the Tether-on-Ink hot-wallet family. `to` wallet =
// deposit (inbound), `from` wallet = withdrawal (outbound).
const CEX_WALLETS: Address[] = [
  Address.fromString('0x63349d2D47D98c1Ae3B7eF810e392c9de6E3f441'), // USDT0 $3.6M/$3.6M
  Address.fromString('0x19dADEe1a035c9df56511E9ae19C7B84232b561e'), // USDT0 $2.7M/$2.7M
  Address.fromString('0x85caeABDAdE01D1073eF00847946E6F221Fd8a53'), // USDT0 $2.5M/$2.5M
  Address.fromString('0xf949341B4201Aa2A814b3cE17041d4179d11380c'), // USDT0 $1.8M/$1.7M
  Address.fromString('0x564584c854AE7486892619822c5CCac1C2CE6Db2'), // USDT0 $0.7M/$0.7M
  Address.fromString('0xf70da97812CB96acDF810712Aa562db8dfA3dbEF'), // USDT0 $0.2M/$0.2M + USDC
];

// Tracked tokens (Ink, verified): native USDC, USDC.e, USDT0, WETH.
const WETH = Address.fromString('0x4200000000000000000000000000000000000006');
const AAVE_ORACLE = Address.fromString('0x4758213271BFdC72224A7a8742dC865fC97756e1');

// --- Pricing ---------------------------------------------------------------

// AaveOracle.getAssetPrice returns USD with 8 decimals (probed on Ink, 2026-08-28:
// WETH = 247691000000, USDC = 99998510). WETH has 18 token decimals, so
// amountUsd = rawAmount * price / 10^(18+8).
const BIG_INT_1E26 = BigInt.fromString('100000000000000000000000000');
// Stable tokens (6 decimals, pegged $1): amountUsd = rawAmount / 10^6.
const STABLE_DIV_BD = BigDecimal.fromString('1000000');

function usdValue(token: Address, rawAmount: BigInt): BigDecimal {
  if (token == WETH) {
    const oracle = AaveOracle.bind(AAVE_ORACLE);
    const price = oracle.try_getAssetPrice(WETH);
    if (!price.reverted && price.value.gt(BigInt.zero())) {
      return rawAmount.times(price.value).div(BIG_INT_1E26).toBigDecimal();
    }
    return BigDecimal.zero();
  }
  return rawAmount.toBigDecimal().div(STABLE_DIV_BD);
}

// --- Mapping ---------------------------------------------------------------

function contains(list: Address[], addr: Address): boolean {
  for (let i = 0; i < list.length; i++) {
    if (list[i].equals(addr)) return true;
  }
  return false;
}

export function handleTransfer(event: TransferEvent): void {
  const from = event.params.from;
  const to = event.params.to;
  const token = event.address;
  const amount = event.params.value;
  const ts = event.block.timestamp;
  const id = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  const amountUsd = usdValue(token, amount);

  // Classification order matters: bridge rules first (a bridge address is never
  // a CEX wallet), then CEX deposit/withdrawal.
  if (contains(BRIDGES, to)) {
    const e = new BridgeTransfer(id);
    e.hash = event.transaction.hash;
    e.fromChain = 'ink';
    e.toChain = 'other';
    e.from = from;
    e.to = to;
    e.token = token;
    e.amount = amount;
    e.amountUsd = amountUsd;
    e.direction = 'outbound';
    e.timestamp = ts;
    e.save();
    return;
  }

  if (contains(BRIDGES, from)) {
    const e = new BridgeTransfer(id);
    e.hash = event.transaction.hash;
    e.fromChain = 'other';
    e.toChain = 'ink';
    e.from = from;
    e.to = to;
    e.token = token;
    e.amount = amount;
    e.amountUsd = amountUsd;
    e.direction = 'inbound';
    e.timestamp = ts;
    e.save();
    return;
  }

  if (contains(CEX_WALLETS, to)) {
    const e = new CexTransfer(id);
    e.hash = event.transaction.hash;
    e.from = from;
    e.to = to;
    e.token = token;
    e.amount = amount;
    e.amountUsd = amountUsd;
    e.type = 'deposit';
    e.direction = 'inbound';
    e.timestamp = ts;
    e.save();
    return;
  }

  if (contains(CEX_WALLETS, from)) {
    const e = new CexTransfer(id);
    e.hash = event.transaction.hash;
    e.from = from;
    e.to = to;
    e.token = token;
    e.amount = amount;
    e.amountUsd = amountUsd;
    e.type = 'withdrawal';
    e.direction = 'outbound';
    e.timestamp = ts;
    e.save();
  }
}
