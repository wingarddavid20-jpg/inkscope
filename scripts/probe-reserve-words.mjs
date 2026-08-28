// Decode the raw 15-word getReserveData return to locate the real
// aTokenAddress / debtTokenAddress slots in this custom pool.
import { ethers } from 'ethers';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const apiKey = env.match(/NEXT_PUBLIC_ALCHEMY_API_KEY=(.*)/m)[1].trim();
const a = JSON.parse(fs.readFileSync('data/tydro-addresses.json', 'utf8'));
const p = new ethers.JsonRpcProvider(
  `https://ink-mainnet.g.alchemy.com/v2/${apiKey}`,
  a.chainId,
  { staticNetwork: true }
);

const USDC = '0x2D270e6886d130D724215A266106e6832161EAEd';
const KNOWN_ATOKEN = '0x70A38B0c90441e991346B7A0Cd98C8528dD1c234'; // verified earlier session
const KNOWN_UNDERLYING = '0x2D270e6886d130D724215A266106e6832161EAEd';

const data = '0x35ea6a75' + USDC.slice(2).toLowerCase().padStart(64, '0'); // getReserveData(address)
const raw = await p.call({ to: a.pool, data });

const abiCoder = ethers.AbiCoder.defaultAbiCoder();
const words = abiCoder.decode(['uint256[15]'], raw)[0];

for (let i = 0; i < words.length; i++) {
  const w = words[i];
  let label = '';
  const hex = '0x' + w.toString(16).padStart(64, '0');
  // heuristic: addresses are 40-hex values with high bytes zero
  if (w < 2n ** 160n && w > 0n) {
    const addr = ethers.getAddress('0x' + w.toString(16).padStart(40, '0'));
    if (addr.toLowerCase() === KNOWN_ATOKEN.toLowerCase()) label = ' <== aToken (USDC)';
    else if (addr.toLowerCase() === KNOWN_UNDERLYING.toLowerCase()) label = ' <== underlying?';
    else label = ' <== address';
  }
  console.log(`word ${i}: ${hex}${label}`);
}
