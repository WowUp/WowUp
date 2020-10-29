import { Field, Message, Type } from "protobufjs";
import { Client } from "./client";

@Type.d("Product")
export class Product extends Message<Product> {
  @Field.d(1, "string")
  public name: string;

  @Field.d(2, "string")
  public alias: string;

  @Field.d(3, Client)
  public client: Client;

  @Field.d(6, "string")
  public family: string;
}
