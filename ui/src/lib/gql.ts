const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "";

export async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${GATEWAY}/graphql`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`graphql ${res.status}`);
  const body = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (body.errors?.length) throw new Error(body.errors[0].message);
  if (!body.data) throw new Error("graphql: empty data");
  return body.data;
}
