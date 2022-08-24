import { transactions, utils, WalletConnection, providers } from 'near-api-js';
import Container from '../../components/containers/Container';
import Main from '../../components/Main';
import React, { useEffect, useState } from 'react';
import banner from '../../public/images/promotionheader.png';
import 'regenerator-runtime/runtime';
import Head from 'next/head';
import Select from 'react-select';
import mint from '../../public/images/mintpage.png';
import ProgressBar from '@ramonak/react-progress-bar';
import Usdt from '../../public/images/SVG/usdt';
import Usdc from '../../public/images/SVG/usdc';
import USN from '../../public/images/SVG/usn';
import { useWalletSelector } from '../../contexts/WalletSelectorContext';
import BigNumber from 'bignumber.js';
import { getConfig, getContract, getRPCProvider } from '../../utils/near';

import { MINTER, NEP141USDC, NEP141USDT, NEP141USN } from '../../data/constants/nearContracts';

const MINT_STORAGE_COST_TESTNET = 5870000000000000000000;
const MINT_STORAGE_COST = 9930000000000000000000;
const DECIMALS_NEAR = 1000000000000000000000000;
const DEFAULT_MAX_FEES = '300000000000000';
const RESERVED_AMOUNT = 200;
const NANO_TO_SECONDS_DENOMINATOR = 1000000;

export default function Home(props) {
  const { selector, modal, accounts, accountId } = useWalletSelector();

  //const { network } = selector.options;
  const provider = new providers.JsonRpcProvider({
    url: getRPCProvider(),
  });
  const { contract } = selector.store.getState();

  const options = [
    { value: 'national', label: 'National Football League' },
    { value: 'local', label: 'Local Football League' },
    { value: 'international', label: 'International Football League' },
  ];
  // Re-use this data to display the state
  const [minterConfig, setMinterConfig] = useState({
    minting_price_decimals_6: '',
    minting_price_decimals_18: '',
    admin: '',
    usdc_account_id: '',
    usdt_account_id: '',
    private_sale_start: 0,
    public_sale_start: 0,
    nft_pack_contract: '',
    nft_pack_supply_index: 0,
    nft_pack_max_sale_supply: 0,
    nft_pack_mint_counter: 0,
  });
  // Storage deposit is used to check if balance available to mint NFT and pay the required storage fee
  const [storageDepositAccountBalance, setStorageDepositAccountBalance] = useState(0);
  const [selectedMintAmount, setSelectedMintAmount] = useState(0);
  const [minted, setMinted] = useState(0);
  const [useNEP141, setUseNEP141] = useState(NEP141USDT);
  const [intervalSale, setIntervalSale] = useState(0);
  const [balanceErrorMsg, setBalanceErrorMsg] = useState('');

  function query_config_contract() {
    provider
      .query({
        request_type: 'call_function',
        finality: 'optimistic',
        account_id: getContract(MINTER),
        method_name: 'get_config',
        args_base64: '',
      })
      .then((data) => {
        // @ts-ignore:next-line
        const config = JSON.parse(Buffer.from(data.result).toString());
        // Save minter config into state
        setMinterConfig({ ...config });
      });
  }

  async function query_minting_of() {
    try {
      if (selector.isSignedIn()) {
        const query = JSON.stringify({ account: accountId });
        const minting_of = await provider.query({
          request_type: 'call_function',
          finality: 'optimistic',
          account_id: contract.contractId,
          method_name: 'get_minting_of',
          args_base64: Buffer.from(query).toString('base64'),
        });
        // @ts-ignore:next-line
        const _minted = JSON.parse(Buffer.from(minting_of.result).toString());
        setMinted(_minted);
      }
    } catch (e) {
      // define default minted
      setMinted(0);
    }
  }

  async function query_storage_deposit_account_id() {
    try {
      if (selector.isSignedIn()) {
        // Get storage deposit on minter contract
        const query = JSON.stringify({ account: accountId });

        const storage_balance = await provider.query({
          request_type: 'call_function',
          finality: 'optimistic',
          account_id: contract.contractId,
          method_name: 'get_storage_balance_of',
          args_base64: Buffer.from(query).toString('base64'),
        });
        // @ts-ignore:next-line
        const storageDeposit = JSON.parse(Buffer.from(storage_balance.result).toString());
        setStorageDepositAccountBalance(storageDeposit);
      }
    } catch (e) {
      // No account storage deposit found
      setStorageDepositAccountBalance(0);
    }
  }

  async function execute_batch_transaction_storage_deposit_and_mint_token() {
    const amount_to_deposit_near = new BigNumber(selectedMintAmount)
      .multipliedBy(new BigNumber(MINT_STORAGE_COST))
      .toFixed();

    const data_one = Buffer.from(JSON.stringify({}));
    const action_deposit_storage_near_token = {
      type: 'FunctionCall',
      params: {
        methodName: 'storage_deposit',
        args: data_one,
        gas: DEFAULT_MAX_FEES,
        deposit: amount_to_deposit_near,
      },
    };

    // FT amount to deposit for minting NFT
    const mint_cost =
      selectedMintAmount *
      Number(
        useNEP141.decimals == 1000000
          ? minterConfig.minting_price_decimals_6
          : minterConfig.minting_price_decimals_18
      );

    try {
      const query = JSON.stringify({ account_id: accountId });
      const ft_balance_of = await provider.query({
        request_type: 'call_function',
        finality: 'optimistic',
        account_id: getContract(useNEP141),
        method_name: 'ft_balance_of',
        args_base64: Buffer.from(query).toString('base64'),
      });
      // @ts-ignore:next-line

      const balance = JSON.parse(Buffer.from(ft_balance_of.result).toString());
      if (balance < mint_cost) {
        setBalanceErrorMsg('Error you need 200 ' + useNEP141.title);
        return;
      }
      setBalanceErrorMsg('');
    } catch (e) {
      console.log(e);
      return;
    }

    if (selectedMintAmount == 0) {
      return;
    }

    const data_two = Buffer.from(
      JSON.stringify({
        receiver_id: selector.store.getState().contract.contractId,
        amount: Math.floor(mint_cost).toString(),
        msg: JSON.stringify({ mint_amount: selectedMintAmount }),
      })
    );
    //const register = Buffer.from(JSON.stringify({account_id:  _minter.contractList[0].contractId}))

    const action_transfer_call = {
      type: 'FunctionCall',
      params: {
        methodName: 'ft_transfer_call',
        args: data_two,
        gas: DEFAULT_MAX_FEES,
        deposit: '1',
      },
    };

    const wallet = await selector.wallet();
    // @ts-ignore:next-line
    const tx = wallet.signAndSendTransactions({
      transactions: [
        {
          receiverId: selector.store.getState().contract.contractId,
          // @ts-ignore:next-line
          actions: [action_deposit_storage_near_token],
        },
        {
          receiverId: getContract(useNEP141),
          // @ts-ignore:next-line
          actions: [action_transfer_call],
        },
      ],
    });
  }

  async function execute_mint_token() {
    // Init minter contract
    //const _minter = await initNear([MINTER, useNEP141]);

    // FT amount to deposit for minting NFT
    const mint_cost =
      selectedMintAmount *
      Number(
        useNEP141.decimals == 1000000
          ? minterConfig.minting_price_decimals_6
          : minterConfig.minting_price_decimals_18
      );

    if (selectedMintAmount == 0) {
      return;
    }

    const data = Buffer.from(
      JSON.stringify({
        receiver_id: selector.store.getState().contract.contractId,
        amount: Math.floor(mint_cost).toString(),
        msg: JSON.stringify({ mint_amount: selectedMintAmount }),
      })
    );
    //const register = Buffer.from(JSON.stringify({account_id:  _minter.contractList[0].contractId}))

    const action_transfer_call = {
      functionCall: 'FunctionCall',
      params: {
        methodName: 'ft_transfer_call',
        args: data,
        gas: DEFAULT_MAX_FEES,
        deposit: '1',
      },
    };

    const wallet = await selector.wallet();
    const tx = wallet
      .signAndSendTransaction({
        signerId: accountId,
        receiverId: getContract(useNEP141),
        actions: [
          // @ts-ignore:next-line
          action_transfer_call,
        ],
      })
      .catch((e) => {
        console.log('error');
        console.log(e);
      });
  }

  async function execute_storage_deposit() {
    // Calculate amount to deposit for minting process
    const amount_to_deposit_near = BigInt(selectedMintAmount * MINT_STORAGE_COST).toString();

    const _data = Buffer.from(JSON.stringify({}));
    const action_deposit_storage_near_token = {
      type: 'FunctionCall',
      params: {
        methodName: 'storage_deposit',
        args: _data,
        gas: DEFAULT_MAX_FEES,
        deposit: amount_to_deposit_near,
      },
    };

    const wallet = await selector.wallet();
    const tx = wallet
      .signAndSendTransaction({
        signerId: accountId,
        receiverId: selector.store.getState().contract.contractId,
        actions: [
          // @ts-ignore:next-line
          action_deposit_storage_near_token,
        ],
      })
      .catch((e) => {
        console.log('error');
        console.log(e);
      });
  }

  function selectMint() {
    let optionMint = [];
    for (let x = 1; x < 16; x++) {
      optionMint.push({ value: x, label: `Get ${x} ${x > 1 ? 'packs' : 'pack'}` });
    }
    return (
      <Select
        onChange={(event) => setSelectedMintAmount(event.value)}
        options={optionMint}
        className="md:w-1/3 w-4/5 mr-9 mt-5"
      />
    );
  }

  function format_price() {
    let price = Math.floor(
      Number(
        useNEP141.decimals === 1000000
          ? minterConfig.minting_price_decimals_6
          : minterConfig.minting_price_decimals_18
      ) / useNEP141.decimals
    );
    return price;
  }

  function counter() {
    const seconds = Math.floor((intervalSale / 1000) % 60);
    const minutes = Math.floor((intervalSale / 1000 / 60) % 60);
    const hours = Math.floor((intervalSale / (1000 * 60 * 60)) % 24);
    const days = Math.floor(intervalSale / (1000 * 60 * 60 * 24));

    let format_seconds = seconds < 0 ? 0 : seconds < 10 ? '0' + seconds : seconds;
    let format_minutes = minutes < 0 ? 0 : minutes < 10 ? '0' + minutes : minutes;
    let format_hours = hours < 0 ? 0 : hours < 10 ? '0' + hours : hours;
    let format_days = days < 0 ? 0 : days < 10 ? '0' + days : days;

    return {
      minute: format_minutes,
      seconds: format_seconds,
      hours: format_hours,
      days: format_days,
    };
  }
  useEffect(() => {
    query_config_contract();
    query_storage_deposit_account_id();
    query_minting_of();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setIntervalSale(
        Math.floor(minterConfig.public_sale_start / NANO_TO_SECONDS_DENOMINATOR) - Date.now()
      );
      if (intervalSale > 0) {
        counter();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [intervalSale]);

  return (
    <>
      <Head>
        <title>Playible - Next Generation of Sports Collectibles</title>
        <link rel="icon" type="image/png" sizes="16x16" href="images/favicon.png" />
      </Head>
      <Container activeName="MINT">
        <div className="flex flex-col w-screen md:w-full overflow-y-auto h-screen justify-center self-center md:pb-12 text-indigo-black">
          <Main color="indigo-white">
            <div className="flex flex-col md:flex-row md:ml-12">
              <div className="md:w-full overflow-x-hidden">
                <div className="flex-col flex justify-center align-center md:flex-row md:flex md:justify-between w-full ml-4 mt-8">
                  <div className="text-xl mt-5 font-bold font-monument ">
                    MINT PACKS
                    <hr className="w-10 border-4"></hr>
                  </div>

                  {/**<Select options={options} className="md:w-1/3 w-4/5 mr-9 mt-5" />**/}
                </div>
                <div className="flex-col flex w-full mt-8 ">
                  <div className="align-center justify-center border-2 p-8 mr-8 rounded-lg">
                    <div className="text-m">
                      Early Bird Offer: The first 500 minted will receive an additional free
                      promotional pack.
                    </div>
                  </div>
                </div>
                <div className="flex md:flex-row flex-col mt-12">
                  <div className="md:w-1/2 w-full ">
                    <img src={mint}></img>
                  </div>
                  <div className="md:w-1/2 w-full md:mt-0 mt-5 ml-8  ">
                    <div className="text-xl font-bold font-monument ">
                      STARTER PACK MINT
                      <hr className="w-10 border-4"></hr>
                    </div>
                    <div className="flex justify-between w-4/5 md:w-1/2 mt-5">
                      <div>
                        <div className="text-xs">PRICE</div>
                        <div className="font-black"> ${format_price()}</div>
                      </div>
                      <div className="border">
                        <button
                          onClick={() => setUseNEP141(NEP141USDT)}
                          className={
                            'p-3 ' +
                            (useNEP141.title == NEP141USDT.title
                              ? 'bg-indigo-black'
                              : 'hover:bg-indigo-slate')
                          }
                        >
                          <Usdt
                            hardCodeMode={useNEP141.title == NEP141USDT.title ? '#fff' : '#000'}
                          ></Usdt>
                        </button>
                        <button
                          onClick={() => setUseNEP141(NEP141USDC)}
                          className={
                            'p-3 ' +
                            (useNEP141.title == NEP141USDC.title
                              ? 'bg-indigo-black'
                              : 'hover:bg-indigo-slate')
                          }
                        >
                          <Usdc
                            hardCodeMode={useNEP141.title == NEP141USDC.title ? '#fff' : '#000'}
                          ></Usdc>
                        </button>
                        <button
                          onClick={() => setUseNEP141(NEP141USN)}
                          className={
                            'p-3 ' +
                            (useNEP141.title == NEP141USN.title
                              ? 'bg-indigo-black'
                              : 'hover:bg-indigo-slate')
                          }
                        >
                          <USN
                            hardCodeMode={useNEP141.title == NEP141USN.title ? '#fff' : '#000'}
                          ></USN>
                        </button>
                      </div>
                    </div>
                    {(counter().days > 0 ||
                      counter().hours > 0 ||
                      counter().minute > 0 ||
                      counter().seconds > 0) && (
                      <>
                        <div className="text-xs mt-8">MINT STARTS IN</div>
                        <div className="flex mt-3">
                          <div className="p-3 rounded-lg bg-indigo-black text-indigo-white">
                            {counter().hours}
                          </div>
                          <div className="p-3 ">:</div>
                          <div className="p-3 rounded-lg  bg-indigo-black text-indigo-white">
                            {counter().minute}
                          </div>
                          <div className="p-3 ">:</div>
                          <div className="p-3  rounded-lg bg-indigo-black text-indigo-white">
                            {counter().seconds}
                          </div>
                        </div>
                      </>
                    )}

                    <div className="border border-indigo-lightgray rounded-2xl text-center p-4 w-40 flex flex-col justify-center  mt-8">
                      <div className="text-2xl font-black font-monument ">{minted}</div>
                      <div className="text-xs">YOU HAVE MINTED</div>
                    </div>
                    <div className="mt-8 mb-0 p-0 w-4/5">
                      <ProgressBar
                        completed={parseInt(
                          (
                            ((minterConfig.nft_pack_max_sale_supply -
                              minterConfig.nft_pack_mint_counter -
                              200) *
                              100) /
                            (minterConfig.nft_pack_max_sale_supply + RESERVED_AMOUNT)
                          ).toFixed(2)
                        )}
                        maxCompleted={100}
                        bgColor={'#3B62F6'}
                      />
                    </div>
                    <div className="text-xs ">
                      {' '}
                      {minterConfig.nft_pack_max_sale_supply -
                        minterConfig.nft_pack_mint_counter -
                        200}
                      /{minterConfig.nft_pack_max_sale_supply + RESERVED_AMOUNT} packs remaining
                    </div>
                    <div>{selectMint()}</div>
                    {/*TODO: start styling */}
                    {/*<div>*/}
                    {/*  <p>Receipt total price ${Math.floor((selectedMintAmount * parseInt(minterConfig.minting_price)) / STABLE_DECIMAL)}</p>*/}
                    {/*  <p>Gas price {utils.format.formatNearAmount(BigInt(selectedMintAmount * MINT_STORAGE_COST).toString()).toString()}N</p>*/}
                    {/*</div>*/}
                    {Math.floor(minterConfig.public_sale_start / NANO_TO_SECONDS_DENOMINATOR) <=
                      Date.now() && selector.isSignedIn() ? (
                      {
                        /*parseInt(String(storageDepositAccountBalance)) >= selectedMintAmount * MINT_STORAGE_COST*/
                      } ? (
                        <>
                          {' '}
                          <button
                            className="w-9/12 flex text-center justify-center items-center bg-indigo-buttonblue font-montserrat text-indigo-white p-4 text-xs mt-8 "
                            onClick={() =>
                              execute_batch_transaction_storage_deposit_and_mint_token()
                            }
                          >
                            Mint ${Math.floor(selectedMintAmount * format_price())} + fee{' '}
                            {utils.format.formatNearAmount(
                              new BigNumber(selectedMintAmount)
                                .multipliedBy(new BigNumber(MINT_STORAGE_COST))
                                .toFixed()
                            )}
                            N
                          </button>
                          <p className="text-xs text-red-700">{balanceErrorMsg}</p>
                        </>
                      ) : (
                        <button
                          className="w-9/12 flex text-center justify-center items-center bg-indigo-buttonblue font-montserrat text-indigo-white p-4 text-xs mt-8 "
                          onClick={() => execute_storage_deposit()}
                        >
                          Storage deposit required{' '}
                          {utils.format.formatNearAmount(
                            BigInt(
                              selectedMintAmount * MINT_STORAGE_COST - storageDepositAccountBalance
                            ).toString()
                          )}
                          N
                        </button>
                      )
                    ) : selector.isSignedIn() ? (
                      <div className="w-9/12 flex text-center justify-center items-center bg-indigo-buttonblue font-montserrat text-indigo-white p-4 text-xs mt-8 ">
                        MINT NFL STARTER PACK SOON
                      </div>
                    ) : (
                      <div className="w-9/12 flex text-center justify-center items-center bg-indigo-buttonblue font-montserrat text-indigo-white p-4 text-xs mt-8 ">
                        WALLET CONNECTION REQUIRED
                      </div>
                    )}

                    {/*TODO: end */}
                  </div>
                </div>
                <div className="ml-8 md:ml-2">
                  <div className="text-xl font-bold font-monument ">
                    PACK DETAILS
                    <hr className="w-10 border-4"></hr>
                  </div>
                  <div className="mt-10">
                    This pack will contain 8 randomly generated <br></br>
                    NFL players.
                  </div>
                  <div className="mt-5 mb-12">
                    <div className="mb-5">1 for each of the positions below:</div>
                    <ul className="marker list-disc pl-5 space-y-3 ">
                      <li> 1 Quarter Back (QB)</li>
                      <li>2 Running Back (RB) </li>
                      <li> 2 Wide Receivers (WR) </li>
                      <li>1 Tight End (TE)</li>
                      <li>1 Flex (RB/WR/TE) </li>
                      <li>1 Super Flex (QB/RB/WR/TE) </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </Main>
        </div>
      </Container>
    </>
  );
}
