import { CollaborativeClaimingView } from './CollaborativeClaimingView'

export default async function SplitPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>
  searchParams: Promise<{ hostToken?: string }>
}) {
  const { sessionId } = await params
  const { hostToken } = await searchParams
  return (
    <CollaborativeClaimingView
      sessionId={sessionId}
      hostTokenParam={hostToken ?? null}
    />
  )
}
