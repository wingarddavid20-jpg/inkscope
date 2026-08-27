import { ethers } from 'ethers';

export const INK_CHAIN_ID = 57073;
export const INK_CHAIN_ID_HEX = '0xdef1';

export const INK_NETWORK_CONFIG = {
  chainId: INK_CHAIN_ID_HEX,
  chainName: 'Ink',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: [
    'https://rpc.inkonchain.com',
    'https://rpc-gel.inkonchain.com',
  ],
  blockExplorerUrls: ['https://explorer.inkonchain.com'],
};

/**
 * Returns the Ethereum provider from window if available.
 */
export function getEthereumProvider(): any | null {
  if (typeof window !== 'undefined' && typeof (window as any).ethereum !== 'undefined') {
    return (window as any).ethereum;
  }
  return null;
}

/**
 * Gets an ethers.js BrowserProvider instance if window.ethereum is present.
 */
export function getBrowserProvider(): ethers.BrowserProvider | null {
  const ethereum = getEthereumProvider();
  if (!ethereum) return null;
  return new ethers.BrowserProvider(ethereum);
}

/**
 * Prompt wallet to switch to Ink Mainnet, adding the chain if it does not exist yet.
 */
export async function switchOrAddInkNetwork(): Promise<boolean> {
  const ethereum = getEthereumProvider();
  if (!ethereum) {
    throw new Error('No Web3 wallet detected. Please install MetaMask or Rabby.');
  }

  try {
    // Try switching first
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: INK_CHAIN_ID_HEX }],
    });
    return true;
  } catch (switchError: any) {
    // Error 4902 means the chain has not been added to MetaMask yet
    if (switchError.code === 4902 || switchError?.data?.originalError?.code === 4902) {
      try {
        await ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [INK_NETWORK_CONFIG],
        });
        return true;
      } catch (addError) {
        console.error('Failed to add Ink network to wallet', addError);
        throw addError;
      }
    } else {
      console.error('Failed to switch to Ink network', switchError);
      throw switchError;
    }
  }
}

/**
 * Connect to user's wallet via BrowserProvider and return the connected address and signer.
 */
export async function connectWallet(): Promise<{ address: string; provider: ethers.BrowserProvider; signer: ethers.JsonRpcSigner }> {
  const ethereum = getEthereumProvider();
  if (!ethereum) {
    throw new Error('No crypto wallet detected. Please install a browser wallet like MetaMask or Rabby.');
  }

  const provider = new ethers.BrowserProvider(ethereum);

  // Request user account authorization
  const accounts: string[] = await provider.send('eth_requestAccounts', []);
  if (!accounts || accounts.length === 0) {
    throw new Error('No accounts selected');
  }

  // Attempt to switch to Ink Mainnet if not already on it
  try {
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== INK_CHAIN_ID) {
      await switchOrAddInkNetwork();
    }
  } catch (networkErr) {
    console.warn('Network switch check warning:', networkErr);
  }

  const signer = await provider.getSigner();
  const address = await signer.getAddress();

  return { address, provider, signer };
}
