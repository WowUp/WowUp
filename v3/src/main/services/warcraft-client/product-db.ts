import pb from 'protobufjs'
import { WowClientType } from '../../../shared/warcraft'

@pb.Type.d('Client')
export class Client extends pb.Message<Client> {
  @pb.Field.d(1, 'string')
  public location = ''

  @pb.Field.d(13, 'string')
  public name = ''
}

@pb.Type.d('Product')
export class Product extends pb.Message<Product> {
  @pb.Field.d(1, 'string')
  public name = ''

  @pb.Field.d(2, 'string')
  public alias = ''

  @pb.Field.d(3, Client)
  public client!: Client

  @pb.Field.d(6, 'string')
  public family = ''

  public wowClientType?: WowClientType
}

@pb.Type.d('ProductDb')
export class ProductDb extends pb.Message<ProductDb> {
  @pb.Field.d(1, Product, 'repeated')
  public products: Product[] = []

  @pb.Field.d(7, 'string', 'repeated')
  public productNames: string[] = []
}
