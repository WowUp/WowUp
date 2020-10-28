import { Field, Message, Type } from "protobufjs";
import { Product } from "./product";

@Type.d("ProductDb")
export class ProductDb extends Message<ProductDb> {
  @Field.d(1, Product, "repeated")
  public products: Product[];

  @Field.d(7, "string", "repeated")
  public productNames: string[];
}
