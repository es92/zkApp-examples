import {
  isReady,
  shutdown,
  Field,
  Mina,
  PrivateKey,
  PublicKey,
  AccountUpdate,
  fetchAccount,
} from 'snarkyjs';

// ========================================================

export const loopUntilAccountExists = async (
  account: PublicKey,
  eachTimeNotExist: () => void,
  isZkAppAccount: boolean = false,
) => {
  for (;;) {
    let response = await fetchAccount({ publicKey: account });
    let accountExists = response.error == null;
    if (isZkAppAccount) {
      accountExists = accountExists && response.account!.appState != null;
    }
    if (!accountExists) {
      await eachTimeNotExist();
      await new Promise(resolve => setTimeout(resolve, 5000))
    } else {
      // TODO add optional check that verification key is correct once this is available in SnarkyJS
      return response.account!;
    }
  }
}

// ========================================================

interface ToString {
  toString: () => string
}

export const makeAndSendTransaction = async <State extends ToString>(
  deployerPrivateKey: PrivateKey,
  zkAppAccount: PublicKey,
  mutateZkApp: () => void,
  transactionFee: number,
  getState: () => State,
  statesEqual: (state1: State, state2: State) => boolean,
) => {

  const initialState = getState();
    
  // Why this line? It increments internal deployer account variables, such as 
  // nonce, necessary for successfully sending a transaction
  await fetchAccount({ publicKey: deployerPrivateKey.toPublicKey() });

  let transaction = await Mina.transaction(
    { feePayerKey: deployerPrivateKey , fee: transactionFee },
    () => { 
      mutateZkApp();
    }
  );

  // fill in the proof - this can take a while...
  console.log('Creating an execution proof...');
  const time0 = Date.now();
  await transaction.prove();
  const time1 = Date.now();
  console.log('creating proof took', (time1 - time0)/1e3, 'seconds')

  console.log('Sending the transaction...');
  const res = await transaction.send();
  const hash = await res.hash(); // This will change in a future version of SnarkyJS
  if (hash == null) {
    console.log('error sending transaction (see above)');
  } else {
    console.log('See transaction at', 'https://berkeley.minaexplorer.com/transaction/' + hash);
  }

  let state = getState();

  let stateChanged = false;
  while (!stateChanged) {
    console.log('waiting for zkApp state to change... (current state: ', state.toString() + ')')
    await new Promise(resolve => setTimeout(resolve, 5000))
    await fetchAccount({ publicKey: zkAppAccount });
    state = await getState();
    stateChanged = !statesEqual(initialState, state);
  }
}

// ========================================================