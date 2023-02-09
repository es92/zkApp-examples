import {
  Account,
  Bool,
  Circuit,
  DeployArgs,
  Field,
  Int64,
  isReady,
  method,
  Mina,
  AccountUpdate,
  Permissions,
  PrivateKey,
  PublicKey,
  SmartContract,
  Token,
  UInt64,
  VerificationKey,
  Struct,
  State,
  state,
  UInt32,
} from 'snarkyjs';

export class WrappedMina extends SmartContract {
  deploy(args?: DeployArgs) {
    super.deploy(args);
    this.setPermissions({
      ...Permissions.default(),
      send: Permissions.proof(),
    });
  }

  @state(UInt64) priorMina = State<UInt64>();

  // ----------------------------------------------------------------------
  
  @method init() {
    super.init();

    let receiver = this.token.mint({
      address: this.address,
      amount: UInt64.from(0),
    });
    // assert that the receiving account is new, so this can be only done once
    receiver.account.isNew.assertEquals(Bool(true));
    // pay fees for opened account
    this.balance.subInPlace(Mina.accountCreationFee());
    this.priorMina.set(UInt64.from(0));
  }

  // ----------------------------------------------------------------------

  @method mintWrappedMinaApprove(
    receiveMinaAccountUpdate: AccountUpdate,
    destination: PublicKey
  ) {
    // receive normal Mina (check receiveMinaAccountUpdate?)
    // mint the token
    // send the token to the caller

    let amountSigned = Int64.fromObject(receiveMinaAccountUpdate.body.balanceChange);
    let amount = amountSigned.magnitude;

    amountSigned.isPositive().assertFalse();

    let MinaTokenId = Field(0)
    receiveMinaAccountUpdate.body.tokenId.assertEquals(MinaTokenId);
    // TODO how know sending right place?
    // TODO how know not making other changes to this token?

    this.token.mint({ address: destination, amount });
  }

  // ----------------------------------------------------------------------

  @method mintWrappedMinaWithoutApprove(
    amount: UInt64,
    destination: PublicKey
  ) {
    //const MinaTokenId = Field(0)

    //const minaAccount = AccountUpdate.create(this.address, MinaTokenId);

    const priorMina = this.priorMina.get();
    this.priorMina.assertEquals(this.priorMina.get());

    const newMina = amount.add(priorMina);

    this.account.balance.assertBetween(newMina, UInt64.MAXINT());

    //minaAccount.send({ to: destination, amount });
    this.token.mint({ address: destination, amount });

    this.priorMina.set(newMina);
  }

  // ----------------------------------------------------------------------

  @method redeemWrappedMinaApprove(
    receiveMinaAccountUpdate: AccountUpdate,
    destination: PublicKey
  ) {
    // TODO
  }

  // ----------------------------------------------------------------------

  @method redeemWrappedMinaWithoutApprove(
    receiveMinaAccountUpdate: AccountUpdate,
    destination: PublicKey
  ) {
    // TODO
  }

  // ----------------------------------------------------------------------

  // let a zkapp send tokens to someone, provided the token supply stays constant
  @method approveUpdateAndSend(
    zkappUpdate: AccountUpdate,
    to: PublicKey,
    amount: UInt64
  ) {
    this.approve(zkappUpdate); // TODO is this secretly approving other changes?

    // see if balance change cancels the amount sent
    let balanceChange = Int64.fromObject(zkappUpdate.body.balanceChange);
    balanceChange.assertEquals(Int64.from(amount).neg());
    // add same amount of tokens to the receiving address
    this.token.mint({ address: to, amount });
  }

  // ----------------------------------------------------------------------

  @method transfer(from: PublicKey, to: PublicKey, value: UInt64) {
    this.token.send({ from, to, amount: value });
  }

  @method transferZkApp(from: PublicKey, to: PublicKey, value: UInt64) {
    // TODO
  }

  // ----------------------------------------------------------------------

  @method getBalance(publicKey: PublicKey): UInt64 {
    let accountUpdate = AccountUpdate.create(
      publicKey,
      this.token.id
    );
    let balance = accountUpdate.account.balance.get();
    accountUpdate.account.balance.assertEquals(
      accountUpdate.account.balance.get()
    );
    return balance;
  }

  // ----------------------------------------------------------------------
}
