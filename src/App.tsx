import * as React from 'react';
import styled from 'styled-components';

import Web3Modal from 'web3modal';
// @ts-ignore
import WalletConnectProvider from '@walletconnect/web3-provider';
import Column from './components/Column';
import Wrapper from './components/Wrapper';
import Header from './components/Header';
import Loader from './components/Loader';
import ConnectButton from './components/ConnectButton';

import { Web3Provider } from '@ethersproject/providers';
import { getChainData, showNotification } from './helpers/utilities';
import {
  BOOK_LIBRARY_ADDRESS
} from './constants';
import BOOK_LIBRARY from './constants/abi/BookLibrary.json';
import LIB_TOKEN from './constants/abi/LIB.json';
import WRAPPER_CONTRACT from './constants/abi/WrapperContract.json';
import { getContract } from './helpers/ethers';
import { logMsg } from './helpers/dev';
import AddBookForm from './components/ResultSubmitForm';
import BooksList from './components/BooksList';
import ErrorMessage from './components/ErrorMessage';
import { ethers } from 'ethers';

const SLayout = styled.div`
  position: relative;
  width: 100%;
  min-height: 100vh;
  text-align: center;
`;

const SContent = styled(Wrapper)`
  width: 100%;
  height: 100%;
  padding: 0 16px;
`;

const SContainer = styled.div`
  height: 100%;
  min-height: 200px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  word-break: break-word;
`;

const SLanding = styled(Column)`
  height: 600px;
`;

// @ts-ignore
const SBalances = styled(SLanding)`
  height: 100%;
  & h3 {
    padding-top: 30px;
  }
`;

interface IAppState {
  fetching: boolean;
  address: string;
  tokenAddress: string;
  wrapperAddress: string;
  library: any;
  connected: boolean;
  chainId: number;
  pendingRequest: boolean;
  result: any | null;
  info: any | null;
  bookLibraryContract: any | null;
  wrapperContract: any | null;
  tokenContract: any | null;
  errorFlag: any | null;
  errorMessage: any | null;
  transactionHash: any | null;
  availableBooks: any | null;
  borrowedBooks: any | null;
  fetchingAddBook: boolean;
  fetchingBooksList: boolean;
  fetchingBorrowBook: boolean;
  fetchingBorrowedBooksList: boolean;
  fetchingReturnBook: boolean;
  fetchingChangingBalances: boolean;
  userBalance: any | null;
  libraryContractBalanceLIB: any | null;
  wrapperContractBalanceETH: any | null;
  libraryContractBalanceETH: any | null;
  rentPrice: any | null;
  iface: any | null;
  signer: any | null;
  hashedMessage: any | null;
  signedMessage: any | null;
  contractOwner: string;
  userIsContractOwner: boolean;
}

const INITIAL_STATE: IAppState = {
  fetching: false,
  address: '',
  tokenAddress: '',
  wrapperAddress: '',
  library: null,
  connected: false,
  chainId: 1,
  pendingRequest: false,
  result: null,
  info: null,
  bookLibraryContract: null,
  wrapperContract: null,
  tokenContract: null,
  errorFlag: null,
  errorMessage: null,
  transactionHash: null,
  availableBooks: null,
  borrowedBooks: null,
  fetchingAddBook: false,
  fetchingBooksList: false,
  fetchingBorrowBook: false,
  fetchingBorrowedBooksList: false,
  fetchingReturnBook: false,
  fetchingChangingBalances: false,
  userBalance: null,
  libraryContractBalanceLIB: null,
  wrapperContractBalanceETH: null,
  libraryContractBalanceETH: null,
  rentPrice: null,
  iface: null,
  signer: null,
  hashedMessage: null,
  signedMessage: null,
  contractOwner: '',
  userIsContractOwner: false

};

class App extends React.Component<any, any> {
  // @ts-ignore
  public web3Modal: Web3Modal;
  public state: IAppState;
  public provider: any;

  constructor(props: any) {
    super(props);
    this.state = {
      ...INITIAL_STATE
    };

    this.web3Modal = new Web3Modal({
      network: this.getNetwork(),
      cacheProvider: true,
      providerOptions: this.getProviderOptions()
    });
  }

  public componentDidMount() {
    if (this.web3Modal.cachedProvider) {
      this.onConnect();
    }
  }

  public onConnect = async () => {
    this.provider = await this.web3Modal.connect();

    const library = new Web3Provider(this.provider);

    const signer = library.getSigner();

    const network = await library.getNetwork();

    const address = this.provider.selectedAddress ? this.provider.selectedAddress : this.provider?.accounts[0];

    const isbookingLibraryAddrValid = ethers.utils.isAddress(BOOK_LIBRARY_ADDRESS);
    let bookLibraryContract;
    let tokenContract;
    let wrapperContract;
    let tokenAddress;
    let wrapperAddress;
    let iface;
    let contractOwner;

    if (isbookingLibraryAddrValid) {
      iface = new ethers.utils.Interface(BOOK_LIBRARY.abi);
      bookLibraryContract = getContract(BOOK_LIBRARY_ADDRESS, BOOK_LIBRARY.abi, library, address);
      tokenAddress = await bookLibraryContract.LIBToken();
      contractOwner = await bookLibraryContract.owner();

      if (ethers.utils.isAddress(tokenAddress)) {
        tokenContract = getContract(tokenAddress, LIB_TOKEN.abi, library, address);

      }

      wrapperAddress = await bookLibraryContract.wrapperContract();

      if (ethers.utils.isAddress(wrapperAddress)) {
        wrapperContract = getContract(wrapperAddress, WRAPPER_CONTRACT.abi, library, address);

      }
    }


    await this.setState({
      library,
      chainId: network.chainId,
      address,
      connected: true,
      bookLibraryContract,
      tokenAddress,
      tokenContract,
      wrapperAddress,
      wrapperContract,
      iface,
      signer,
      contractOwner,
      userIsContractOwner: ethers.utils.getAddress(address) === ethers.utils.getAddress(contractOwner)
    });

    await this.getAvailableBooks();
    await this.getBorrowedBooks();
    await this.getUserBalance();
    await this.getContractsBalances();

    await this.getRentPrice();
    await this.subscribeToProviderEvents(this.provider);

  };

  public subscribeToProviderEvents = async (provider: any) => {
    if (!provider.on) {
      return;
    }

    provider.on("accountsChanged", this.changedAccount);
    provider.on("networkChanged", this.networkChanged);
    provider.on("close", this.close);

    this.state.bookLibraryContract.on("NewBookAdded", this.handleBookAdded);
    this.state.bookLibraryContract.on("BookReturned", this.handleBookReturned);
    this.state.bookLibraryContract.on("BookBorrowed", this.handleBookBorrowed);

    const filterTransfer = this.state.tokenContract.filters.Transfer(
      null, BOOK_LIBRARY_ADDRESS, null
    );

    this.state.tokenContract.on(filterTransfer, async (from: any, to: any, amount: any, event: any) => {
      const getEventBlock = await event.getBlock();
      showNotification(getEventBlock.hash);
    })

    this.state.tokenContract.on("LogPermitted", (addressRecover: any, addressOwner: any, addressSpender: any) => {
      logMsg(addressRecover)
      logMsg(addressOwner)
      logMsg(addressSpender)
    })

    // the following events are for debuging purpose
    this.state.bookLibraryContract.on("UnwrapInBookContract", (amount: any) => { logMsg(ethers.utils.formatEther(amount)) });
    this.state.wrapperContract.on("UnwrapInWrapperContract", (amount: any) => { logMsg(ethers.utils.formatEther(amount)) });

    await this.web3Modal.off('accountsChanged');
  };

  public handleBookAdded = async () => {
    await this.getAvailableBooks();
    showNotification('Book added')
  }

  public handleBookBorrowed = async () => {
    await this.getAvailableBooks();
    await this.getBorrowedBooks();
    await this.getUserBalance();
    await this.getContractsBalances();
    showNotification('Book borrowed')
  }

  public handleBookReturned = async () => {
    await this.getAvailableBooks();
    showNotification('Book returned')
  }

  public async unSubscribe(provider: any) {
    window.location.reload(false);
    if (!provider.off) {
      return;
    }

    provider.off("accountsChanged", this.changedAccount);
    provider.off("networkChanged", this.networkChanged);
    provider.off("close", this.close);

    this.state.bookLibraryContract.off("NewBookAdded", this.handleBookAdded);
    this.state.bookLibraryContract.off("BookReturned", this.handleBookReturned);
    this.state.bookLibraryContract.off("BookBorrowed", this.handleBookBorrowed);
  }

  public changedAccount = async (accounts: string[]) => {
    if (!accounts.length) {
      // Metamask Lock fire an empty accounts array 
      await this.resetApp();
    } else {
      await this.setState({ address: accounts[0] });
    }
  }

  public networkChanged = async (networkId: number) => {
    const library = new Web3Provider(this.provider);
    const network = await library.getNetwork();
    const chainId = network.chainId;
    await this.setState({ chainId, library });
  }

  public close = async () => {
    this.resetApp();
  }

  public getNetwork = () => getChainData(this.state.chainId).network;

  public getProviderOptions = () => {
    const providerOptions = {
      walletconnect: {
        package: WalletConnectProvider,
        options: {
          infuraId: process.env.REACT_APP_INFURA_ID
        }
      }
    };
    return providerOptions;
  };

  public resetApp = async () => {
    await this.web3Modal.clearCachedProvider();
    localStorage.removeItem("WEB3_CONNECT_CACHED_PROVIDER");
    localStorage.removeItem("walletconnect");
    await this.unSubscribe(this.provider);

    this.setState({ ...INITIAL_STATE });

  };

  public addBook = async (bookTitle: string, quantity: number) => {
    const { bookLibraryContract } = this.state;

    this.setState({ fetchingAddBook: true });

    try {
      const transaction = await bookLibraryContract.addBook(bookTitle, quantity);

      this.setState({ transactionHash: transaction.hash });

      const transactionReceipt = await transaction.wait();
      if (transactionReceipt.status !== 1) {
        // React to failure
      }
    }
    catch (e) {
      logMsg(e)
      if (e.error) {
        this.setErrorMessage(e.error.message)
      }
      else if (e.data) {
        this.setErrorMessage(e.data.message)
      }
    }
    finally {
      this.setState({ fetchingAddBook: false })

    }

  }

  public setErrorMessage = (message: any) => {
    if (message) {

      this.setState({ errorMessage: message, errorFlag: true })
    }
  }

  public clearError = () => {
    this.setState({ errorFlag: false, errorMessage: null })
  }

  public getBookIds = async () => {
    const { bookLibraryContract } = this.state;

    const bookKeysLength = await bookLibraryContract.getCount();

    const bookIds: string[] = [];

    for (let bookIndex = 0; bookIndex < bookKeysLength.toNumber(); bookIndex++) {
      const currentBookKey = await bookLibraryContract.bookKeys(bookIndex);
      bookIds.push(currentBookKey);
    }

    return bookIds;
  }

  public getAvailableBooks = async () => {
    const { bookLibraryContract } = this.state;

    this.setState({ fetchingBooksList: true });

    const bookKeysArr = await this.getBookIds();
    let availableBooks = {};

    for (let bookIndex = 0; bookIndex < bookKeysArr.length; bookIndex++) {
      const currentBookKey = bookKeysArr[bookIndex];
      const currentBook = await bookLibraryContract.books(currentBookKey);

      availableBooks = {
        ...availableBooks,
        [currentBookKey]: currentBook
      }
    }

    this.setState({ fetchingBooksList: false, availableBooks });
  }

  public getBorrowedBooks = async () => {
    const { bookLibraryContract, address } = this.state;

    this.setState({ fetchingBorrowedBooksList: true });

    const bookKeysArr = await this.getBookIds();
    let borrowedBooks = {};
    for (let bookIndex = 0; bookIndex < bookKeysArr.length; bookIndex++) {
      const currentBookKey = bookKeysArr[bookIndex];
      const userBorrowedBook = await bookLibraryContract.userBorrowedBooks(address, currentBookKey);
      if (userBorrowedBook === 1) {
        const currentBook = await bookLibraryContract.books(currentBookKey);

        borrowedBooks = {
          ...borrowedBooks,
          [currentBookKey]: currentBook
        }
      }

    }

    this.setState({ fetchingBorrowedBooksList: false, borrowedBooks });
  }

  public borrowBook = async (bookId: string) => {
    const { rentPrice, bookLibraryContract } = this.state;

    this.setState({ fetchingBorrowBook: true });

    try {

      const signature = await this.onAttemptToApprove();

      const transaction = await bookLibraryContract.borrowBookById(bookId, rentPrice, signature.deadline, signature.v, signature.r, signature.s);

      this.setState({ transactionHash: transaction.hash });

      const transactionReceipt = await transaction.wait();
      if (transactionReceipt.status !== 1) {
        // React to failure
      }
    }
    catch (e) {
      logMsg(e)
      if (e.error) {
        this.setErrorMessage(e.error.message)
      }
      else if (e.data) {
        this.setErrorMessage(e.data.message)
      }
    }
    finally {
      this.setState({ fetchingBorrowBook: false })

    }
  }

  public returnBook = async (bookId: string) => {
    const { bookLibraryContract } = this.state;

    this.setState({ fetchingReturnBook: true });

    try {
      const transaction = await bookLibraryContract.returnBookById(bookId);

      this.setState({ transactionHash: transaction.hash });

      const transactionReceipt = await transaction.wait();
      if (transactionReceipt.status !== 1) {
        // React to failure
      }
    }
    catch (e) {
      logMsg(e)
      if (e.error) {
        this.setErrorMessage(e.error.message)
      }
      else if (e.data) {
        this.setErrorMessage(e.data.message)
      }
    }
    finally {
      this.setState({ fetchingReturnBook: false })

    }
  }

  public getUserBalance = async () => {
    const { tokenContract, address } = this.state;

    const userBalance1 = await tokenContract.balanceOf(address);

    const userBalance = ethers.utils.formatEther(userBalance1)

    this.setState({ userBalance });
  }

  public getContractsBalances = async () => {

    const { tokenContract, library, wrapperAddress } = this.state;

    const libraryContractBalanceLIbRaw = await tokenContract.balanceOf(BOOK_LIBRARY_ADDRESS);
    const libraryContractBalanceLIB = ethers.utils.formatEther(libraryContractBalanceLIbRaw)

    const libraryContractBalanceETHRaw = await library.getBalance(BOOK_LIBRARY_ADDRESS)
    const libraryContractBalanceETH = ethers.utils.formatEther(libraryContractBalanceETHRaw)

    const wrapperContractBalanceETHRaw = await library.getBalance(wrapperAddress)
    const wrapperContractBalanceETH = ethers.utils.formatEther(wrapperContractBalanceETHRaw)

    this.setState({ libraryContractBalanceLIB, wrapperContractBalanceETH, libraryContractBalanceETH });
  }

  public buyLibTokens = async () => {
    const { wrapperContract } = this.state;

    const wrapValue = ethers.utils.parseEther("0.1");
    this.setState({ fetchingChangingBalances: true })

    try {
      const transaction = await wrapperContract.wrap({ value: wrapValue })
      await transaction.wait();

      const transactionReceipt = await transaction.wait();
      if (transactionReceipt.status !== 1) {
        // React to failure
      }
    }

    catch (e) {
      logMsg(e)
      if (e.error) {
        this.setErrorMessage(e.error.message)
      }
      else if (e.data) {
        this.setErrorMessage(e.data.message)
      }
    }
    finally {
      this.setState({ fetchingChangingBalances: false })

    }

    await this.getUserBalance()
    await this.getContractsBalances()
  }

  public unWrapTokenIntoContract = async () => {
    const { bookLibraryContract } = this.state;

    this.setState({ fetchingChangingBalances: true });
    try {

      const wrapValue = ethers.utils.parseEther("0.01")

      const transaction = await bookLibraryContract.exchangeTokens(wrapValue);


      const transactionReceipt = await transaction.wait();
      if (transactionReceipt.status !== 1) {
        // React to failure
      }

    }
    catch (e) {
      logMsg(e)
      if (e.error) {
        this.setErrorMessage(e.error.message)
      }
      else if (e.data) {
        this.setErrorMessage(e.data.message)
      }
    }
    finally {
      this.setState({ fetchingChangingBalances: false })

    }

    await this.getUserBalance();
    await this.getContractsBalances();

  }

  public getRentPrice = async () => {
    const { bookLibraryContract } = this.state;

    const rentPrice = await bookLibraryContract.rentPrice();

    this.setState({ rentPrice })
  }

  public withDrawLibrarayETH = async () => {
    const { bookLibraryContract, library } = this.state;

    this.setState({ fetchingChangingBalances: true });
    try {
      const libraryContractBalanceETHRaw = await library.getBalance(BOOK_LIBRARY_ADDRESS)
      const transaction = await bookLibraryContract.withdraw(libraryContractBalanceETHRaw);


      const transactionReceipt = await transaction.wait();
      if (transactionReceipt.status !== 1) {
        // React to failure
      }

    }
    catch (e) {
      logMsg(e)
      if (e.error) {
        this.setErrorMessage(e.error.message)
      }
      else if (e.data) {
        this.setErrorMessage(e.data.message)
      }
    }

    await this.getUserBalance();
    await this.getContractsBalances();
  }

  public signWrapMessage = async (messageToSign: any) => {
    const { signer } = this.state;

    const hashedMessage = ethers.utils.solidityKeccak256(['string'], [messageToSign]);

    const arrayfiedHash = ethers.utils.arrayify(hashedMessage);

    const signedMessage = await signer.signMessage(arrayfiedHash);

    logMsg(hashedMessage)
    logMsg(signedMessage)
  }

  public signForborrowingBook = async () => {
    const { signer, rentPrice, tokenContract } = this.state;
    const messageToSign = 'Allow borrow this book from another acc'

    const hashedMessage = ethers.utils.solidityKeccak256(['string'], [messageToSign]);

    const arrayfiedHash = ethers.utils.arrayify(hashedMessage);

    const signedMessage = await signer.signMessage(arrayfiedHash);

    const approveTx = await tokenContract.approve(BOOK_LIBRARY_ADDRESS, rentPrice);
    await approveTx.wait();

    logMsg(hashedMessage)
    logMsg(signedMessage)

  }

  public borrowSignedBook = async () => {
    const { bookLibraryContract } = this.state;
    // TODO implement input fields where these values could be fulfilled
    const signedMessage = '0xdf12d86b2bb09c2fa316f5dae7e98dc9c67b945337cf8d49065127081ca28b223e338b0936860e5ec5c1cfbc1caed5f9814687e1d5c85865a5169729541428bc1c'
    const hashedMessage = '0xf25626ca4e6854665dd796172b32bc4cf05721a036483fdb896d0fd11189d99b'
    // Just taking the first available book
    const bookKeysArr = await this.getBookIds();
    const bookId = bookKeysArr[0];
    const receiver = "0xD9995BAE12FEe327256FFec1e3184d492bD94C31";

    const sig = ethers.utils.splitSignature(signedMessage);

    try {
      const wrapTx = await bookLibraryContract.borrowWithSignature(hashedMessage, sig.v, sig.r, sig.s, receiver, bookId)

      const transactionReceipt = await wrapTx.wait();
      if (transactionReceipt.status !== 1) {
        // React to failure
      }
    }
    catch (e) {
      logMsg(e)
      if (e.error) {
        this.setErrorMessage(e.error.message)
      }
      else if (e.data) {
        this.setErrorMessage(e.data.message)
      }
    }
  }

  public wrapWithSignedMessage = async () => {
    const { wrapperContract } = this.state;
    // TODO implement input fields where these values could be fulfilled

    const signedMessage = '0x1100b2ba29fe21ceeda4351f7dad1d2481c1abca7d207dd2ce01b9015e58e3ef6bb065cc984d61883f6f28aeb4450459262d85e8239e34f9241d91c15129cbaa1c'
    const hashedMessage = '0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470'

    const wrapValue = ethers.utils.parseEther("0.1");
    const receiver = "0xD9995BAE12FEe327256FFec1e3184d492bD94C31";

    const sig = ethers.utils.splitSignature(signedMessage);

    try {
      const wrapTx = await wrapperContract.wrapWithSignature(hashedMessage, sig.v, sig.r, sig.s, receiver, { value: wrapValue })

      const transactionReceipt = await wrapTx.wait();
      if (transactionReceipt.status !== 1) {
        // React to failure
      }
    }
    catch (e) {
      logMsg(e)
      if (e.error) {
        this.setErrorMessage(e.error.message)
      }
      else if (e.data) {
        this.setErrorMessage(e.data.message)
      }
    }
  }

  public onAttemptToApprove = async () => {
    const { tokenContract, address, library, rentPrice } = this.state;

    const nonce = (await tokenContract.nonces(address)); // Our Token Contract Nonces
    const deadline = + new Date() + 60 * 60; // Permit with deadline which the permit is valid
    const wrapValue = rentPrice; // Value to approve for the spender to use

    const EIP712Domain = [ // array of objects -> properties from the contract and the types of them ircwithPermit
      { name: 'name', type: 'string' },
      { name: 'version', type: 'string' },
      { name: 'verifyingContract', type: 'address' }
    ];

    const domain = {
      name: await tokenContract.name(),
      version: '1',
      verifyingContract: tokenContract.address
    };

    const Permit = [ // array of objects -> properties from erc20withpermit
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' }
    ];

    const message = {
      owner: address,
      spender: BOOK_LIBRARY_ADDRESS,
      value: wrapValue.toString(),
      nonce: nonce.toHexString(),
      deadline
    };

    const data = JSON.stringify({
      types: {
        EIP712Domain,
        Permit
      },
      domain,
      primaryType: 'Permit',
      message
    })

    const signatureLike = await library.send('eth_signTypedData_v4', [address, data]);
    const signature = await ethers.utils.splitSignature(signatureLike)

    const preparedSignature = {
      v: signature.v,
      r: signature.r,
      s: signature.s,
      deadline
    }

    return preparedSignature
  }

  public render = () => {
    const {
      address,
      connected,
      chainId,
      fetching,
      fetchingAddBook,
      fetchingBooksList,
      fetchingBorrowBook,
      fetchingBorrowedBooksList,
      fetchingReturnBook,
      transactionHash,
      availableBooks,
      borrowedBooks,
      errorFlag,
      errorMessage
    } = this.state;
    return (
      <SLayout>
        <Column maxWidth={1000} spanHeight>
          <Header
            connected={connected}
            address={address}
            chainId={chainId}
            killSession={this.resetApp}
          />
          <SContent>
            {fetching ? (
              <Column center>
                <SContainer>
                  <Loader />
                </SContainer>
              </Column>
            ) : (
              <SLanding center>
                {!this.state.connected && <ConnectButton onClick={this.onConnect} />}
                {
                  this.state.connected &&
                  <div>
                    {
                      this.state.userIsContractOwner &&
                      <AddBookForm
                        addBook={this.addBook}
                        transactionHash={transactionHash}
                        fetchingAddBook={fetchingAddBook}
                      />
                    }

                    <BooksList
                      itemsList={availableBooks || {}}
                      onClick={this.borrowBook}
                      fetchingList={fetchingBooksList}
                      fetchingOnClickAction={fetchingBorrowBook}
                      transactionHash={transactionHash}
                      title={"Books list (click over title if you want to rent certain book)"}
                      showQuantity={true}
                    />
                    <BooksList
                      itemsList={borrowedBooks || {}}
                      onClick={this.returnBook}
                      fetchingList={fetchingBorrowedBooksList}
                      fetchingOnClickAction={fetchingReturnBook}
                      transactionHash={transactionHash}
                      title={"Your rented books (click over a title to return the book)"}
                      showQuantity={false}
                    />
                    <div>
                      {this.state.fetchingChangingBalances ? (
                        <Column center>
                          <SContainer>
                            <Loader />
                          </SContainer>
                        </Column>
                      ) : (
                        <div>
                          <div>
                            <span>{`User current LIBToken balance is: ${this.state.userBalance}`}</span>
                            <button onClick={this.buyLibTokens}>Buy LIBToken</button>
                          </div>
                          <div>
                            <span>{`Book library Contract LIBToken balance is: ${this.state.libraryContractBalanceLIB}`}</span>
                            {this.state.userIsContractOwner && <button onClick={this.unWrapTokenIntoContract}>unwrap Library contract lib tokens</button>}
                          </div>
                          <div>
                            <span>{`Book library Contract ETH balance is: ${this.state.libraryContractBalanceETH}`}</span>
                            {this.state.userIsContractOwner && <button onClick={this.withDrawLibrarayETH}>withdraw library contract ETH</button>}
                          </div>
                          <div>
                            <span>{`Wrapper Contract ETH balance is: ${this.state.wrapperContractBalanceETH}`}</span>
                          </div>
                        </div>
                      )}

                    </div>
                    <div>
                      <button onClick={this.signWrapMessage}>Sign a message</button>
                    </div>

                    <div>
                      <button onClick={this.wrapWithSignedMessage}>Wrap tokens with signing</button>
                    </div>

                    <div>
                      <button onClick={this.signForborrowingBook}>Sign for borrowing</button>
                    </div>
                    <div>
                      <button onClick={this.borrowSignedBook}>Borrow signed book</button>
                    </div>
                  </div>
                }
                <hr />
                <ErrorMessage errorFlag={errorFlag} errorMessage={errorMessage} clearError={this.clearError} />
              </SLanding>
            )}
          </SContent>
        </Column>
      </SLayout>
    );
  };
}

export default App;
