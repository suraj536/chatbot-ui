"use client"

import { AdStudio } from "@/components/adcraft/ad-studio"
import { useParams } from "next/navigation"

export default function StudioPage() {
  const params = useParams()
  const workspaceId = (params?.workspaceid as string) || ""

  return <AdStudio workspaceId={workspaceId} />
}
