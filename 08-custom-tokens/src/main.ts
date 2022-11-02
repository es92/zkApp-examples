import { BasicTokenContract } from './BasicTokenContract.js';
import {
  isReady,
  shutdown,
  Field,
  Mina,
  PrivateKey,
  PublicKey,
  AccountUpdate,
  UInt64,
  Signature,
} from 'snarkyjs';

(async function main() {
  await isReady;

  console.log('SnarkyJS loaded');

  const Local = Mina.LocalBlockchain();
  Mina.setActiveInstance(Local);
  const deployerAccount = Local.testAccounts[0].privateKey;

  // ----------------------------------------------------

  const zkAppPrivateKey = PrivateKey.random();
  const zkAppAddress = zkAppPrivateKey.toPublicKey();

  const signOnly = true;

  console.log('compiling...');

  let verificationKey: any;
  if (!signOnly) {
    ({ verificationKey } = await BasicTokenContract.compile());
  }

  console.log('compiled');

  // ----------------------------------------------------

  console.log('deploying...');

  const contract = new BasicTokenContract(zkAppAddress);
  const deploy_txn = await Mina.transaction(deployerAccount, () => {
    AccountUpdate.fundNewAccount(deployerAccount);
    if (signOnly) {
      contract.deploy({ zkappKey: zkAppPrivateKey });
    } else {
      contract.deploy({ verificationKey, zkappKey: zkAppPrivateKey });
    }
    contract.sign(zkAppPrivateKey);
  });
  await deploy_txn.send().wait();

  console.log('deployed');

  // ----------------------------------------------------

  console.log('initializing...');

  const init_txn = await Mina.transaction(deployerAccount, () => {
    contract.init();
    if (signOnly) {
      contract.sign(zkAppPrivateKey);
    }
  });
  if (!signOnly) {
    await init_txn.prove();
  }
  await init_txn.send().wait();

  console.log('initialized');

  // ----------------------------------------------------

  console.log('minting...');

  const mintAmount = UInt64.from(10);

  const mintSignature = Signature.create(
    zkAppPrivateKey, 
    mintAmount.toFields().concat(zkAppAddress.toFields())
  );

  const mint_txn = await Mina.transaction(deployerAccount, () => {
    AccountUpdate.fundNewAccount(deployerAccount);
    contract.mint(zkAppAddress, mintAmount, mintSignature);
    //if (signOnly) {
      contract.sign(zkAppPrivateKey);
    //}
  });
  if (!signOnly) {
    await init_txn.prove();
  }
  await mint_txn.send().wait();
  
  console.log('minted');

  console.log(contract.totalAmountInCirculation.get() + ' ' + Mina.getAccount(zkAppAddress).tokenSymbol);

  // ----------------------------------------------------

  console.log('sending...');

  const sendAmount = UInt64.from(3);

  const send_txn = await Mina.transaction(deployerAccount, () => {
    AccountUpdate.fundNewAccount(deployerAccount);
    contract.sendTokens(
      zkAppAddress, 
      deployerAccount.toPublicKey(),
      sendAmount);
    if (signOnly) {
      contract.sign(zkAppPrivateKey);
    }
  });
  send_txn.sign([ zkAppPrivateKey ]);
  if (!signOnly) {
    await init_txn.prove();
  }
  await send_txn.send().wait();
  
  console.log('sent');

  console.log(contract.totalAmountInCirculation.get() + ' ' + Mina.getAccount(zkAppAddress).tokenSymbol);

  // ----------------------------------------------------

  console.log(
    'deployer tokens:',
    Mina.getBalance(
      deployerAccount.toPublicKey(),
      contract.experimental.token.id
    ).value.toBigInt()
  );

  console.log(
    'zkapp tokens:',
    Mina.getBalance(
      zkAppAddress,
      contract.experimental.token.id
    ).value.toBigInt()
  );


  // ----------------------------------------------------

  console.log('Shutting down');

  await shutdown();
})().catch((f) => {
  console.log(f);
});
