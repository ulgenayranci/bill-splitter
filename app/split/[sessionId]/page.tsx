import { CollaborativeClaimingView } from './CollaborativeClaimingView'

// CR-05: hostToken moved to URL fragment (#hostToken=...) so it is never sent to the
// server. The CollaborativeClaimingView client component reads it from window.location.hash.
export default async function SplitPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = await params
  return <CollaborativeClaimingView sessionId={sessionId} />
}
