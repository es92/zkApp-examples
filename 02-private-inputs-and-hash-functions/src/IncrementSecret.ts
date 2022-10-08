import {
  Field,
  SmartContract,
  state,
  State,
  method,
  DeployArgs,
  Poseidon,
  Permissions,
} from 'snarkyjs';

export class IncrementSecret extends SmartContract {
  @state(Field) x = State<Field>();

  deploy(args: DeployArgs) {
    super.deploy(args);
    this.setPermissions({
      ...Permissions.default(),
      editState: Permissions.proofOrSignature(),
    });
  }

  @method init(firstSecret: Field) {
    this.x.set(firstSecret);
  }

  @method incrementSecret(secret: Field) {
    const x = this.x.get();
    this.x.assertEquals(x);

    Poseidon.hash([ secret ]).assertEquals(x);
    this.x.set(Poseidon.hash([ secret.add(1) ]));
  }

}

