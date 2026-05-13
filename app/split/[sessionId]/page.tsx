import { GuestClaimingView } from './GuestClaimingView'

export default async function SplitPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = await params
  return <GuestClaimingView sessionId={sessionId} />
}
