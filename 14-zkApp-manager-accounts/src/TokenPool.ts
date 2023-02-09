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

export class TokenPool extends SmartContract {

  deploy(args?: DeployArgs) {
    super.deploy(args);
    this.account.permissions.set({
      ...Permissions.default(),
      send: Permissions.proof(),
      receive: Permissions.proof(),
    });
  }

  // ----------------------------------------------------------------------
  
  @method init() {
    super.init();
  }

  // ----------------------------------------------------------------------

  @method moveMinaToWrappedMina(
    amount: UInt64,
  ) {

    
    // TODO
  }

  // ----------------------------------------------------------------------

  @method wrappedMinaToMina(
    amount: UInt64,
  ) {
    // TODO
  }

  // ----------------------------------------------------------------------
}
