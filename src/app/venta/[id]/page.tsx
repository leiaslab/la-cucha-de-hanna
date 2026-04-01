import { ProductSalePage } from "../../../../ProductSalePage";

export default async function Page(props: PageProps<"/venta/[id]">) {
  const { id } = await props.params;

  return <ProductSalePage productId={Number(id)} />;
}
