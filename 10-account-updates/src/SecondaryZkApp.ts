import {
  Field,
  SmartContract,
  state,
  State,
  method,
  DeployArgs,
  Permissions,
} from 'snarkyjs';

export class SecondaryZkApp extends SmartContract {
  @state(Field) num = State<Field>();

  deploy(args: DeployArgs) {
    super.deploy(args);
    this.setPermissions({
      ...Permissions.default(),
    });
  }

  @method init() {
    super.init();
    this.num.set(Field(12));
  }

  @method add(incrementBy: Field) {
    this.account.provedState.get().assertTrue();

    const num = this.num.get();
    this.num.assertEquals(num);
    this.num.set(num.add(incrementBy));
  }
}

