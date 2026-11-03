import { Field, Message, Type } from "protobufjs";

@Type.d("Client")
export class Client extends Message<Client> {
  @Field.d(1, "string")
  public location = "";

  @Field.d(13, "string")
  public name = "";
}

@Type.d("VersionInfo")
export class VersionInfo extends Message<VersionInfo> {
  /** Full version including build, e.g. "12.1.5.70688" */
  @Field.d(7, "string")
  public version = "";
}

@Type.d("InstallInfo")
export class InstallInfo extends Message<InstallInfo> {
  @Field.d(1, VersionInfo)
  public versionInfo?: VersionInfo;
}

@Type.d("Product")
export class Product extends Message<Product> {
  @Field.d(1, "string")
  public name = "";

  @Field.d(2, "string")
  public alias = "";

  @Field.d(3, Client)
  public client!: Client;

  @Field.d(4, InstallInfo)
  public installInfo?: InstallInfo;

  @Field.d(6, "string")
  public family = "";
}

@Type.d("ProductDb")
export class ProductDb extends Message<ProductDb> {
  @Field.d(1, Product, "repeated")
  public products: Product[] = [];

  @Field.d(7, "string", "repeated")
  public productNames: string[] = [];
}
