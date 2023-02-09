import { WrappedMina } from './WrappedMina.js'
import { TokenPool } from './TokenPool.js'
import { 
  Mina, 
  PrivateKey, 
  shutdown, 
  isReady,
  AccountUpdate,
  UInt64,
  SmartContract,
  Token,
  PublicKey
} from 'snarkyjs';

// DEX reference code
// https://github.com/o1-labs/snarkyjs/blob/main/src/examples/zkapps/dex/dex.ts

(async () => {
  await isReady;

  let doProofs = false;

  let Local = Mina.LocalBlockchain({
    proofsEnabled: doProofs,
    enforceTransactionLimits: false,
  });

  Mina.setActiveInstance(Local);
  let accountFee = Mina.accountCreationFee();
  let [{ privateKey: feePayerKey, publicKey: feePayerAddress }] = Local.testAccounts;

  let wrappedMinaPrivateKey = PrivateKey.random();
  let wrappedMinaPublicKey = wrappedMinaPrivateKey.toPublicKey();

  let tokenPoolPrivateKey = PrivateKey.random();
  let tokenPoolPublicKey = tokenPoolPrivateKey.toPublicKey();

  let wrappedMinaContract = new WrappedMina(wrappedMinaPublicKey);
  let tokenPoolContract = new TokenPool(tokenPoolPublicKey);

  const printState = () => {
    const tryGetTokenBalance = (addr: PublicKey, tokenAddr?: PublicKey) => {
      try {
        if (tokenAddr == null) {
          return Mina.getBalance(addr).toBigInt();
        } else {
          return Mina.getBalance(addr, Token.getId(tokenAddr)).toBigInt();
        }
      } catch(e) {
        return null;
      }
    }
    console.log('user MINA:',  tryGetTokenBalance(feePayerAddress));
    console.log('user WMINA:', tryGetTokenBalance(feePayerAddress, wrappedMinaPublicKey));

    console.log('WMINA Manager MINA:',  tryGetTokenBalance(wrappedMinaPublicKey));
    console.log('WMINA Manager WMINA:', tryGetTokenBalance(wrappedMinaPublicKey, wrappedMinaPublicKey));
  }

  printState();

  // ------------------------------------------------------------------------

  const deployTx = await Mina.transaction(feePayerAddress, () => {
    let feePayerUpdate = AccountUpdate.fundNewAccount(feePayerAddress, 2);
    feePayerUpdate.send({ to: wrappedMinaPublicKey, amount: accountFee });
    feePayerUpdate.send({ to: tokenPoolPublicKey, amount: accountFee });

    wrappedMinaContract.deploy();
    tokenPoolContract.deploy();
  });
  await deployTx.prove();
  deployTx.sign([ feePayerKey, tokenPoolPrivateKey, wrappedMinaPrivateKey ]);
  await deployTx.send();

  console.log('deployed');

  printState();

  // ------------------------------------------------------------------------
  
  // TODO
  //    1. Make the "WrappedMina" contract
  //    2. Send MINA to the "WrappedMina" contract and get back "WMINA"
  //    3. Send WMINA to the "WrappedMina" contract and get back "MINA"

  const getWMinaTx = await Mina.transaction(feePayerAddress, () => {
    const amount = UInt64.from(10);
    let feePayerUpdate = AccountUpdate.create(feePayerAddress);
    feePayerUpdate.send({ to: wrappedMinaPublicKey, amount });
    //wrappedMinaContract.mintWrappedMinaWithoutApprove(amount, feePayerAddress);
  });
  await getWMinaTx.prove();
  getWMinaTx.sign([ feePayerKey ]);
  await getWMinaTx.send();

  console.log('got WMina');

  printState();


  // ------------------------------------------------------------------------

  // TODO
  //    1. Send Mina to the "TokenPool" contract
  //    2. Tell the TokenPool to exchange Mina for WrappedMina
  //    3. Withdraw WrappedMina from the pool into the user account
  //    4. Deposit WrappedMina into the pool from the user account
  //    5. Tell the TokenPool to exchange WrappedMina for Mina
  //    6. Withdraw Mina from the TokenPool


  // TODO
  //    * Add a call to the TokenPool contract that does things that should be outside of scope with WrappedMina in the "approve" call (eg Minting inappropriately)

  await shutdown();
})();
