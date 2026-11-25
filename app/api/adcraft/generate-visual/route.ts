import {
  AdVisualGenerationError,
  generateAdvertisingVisual
} from "@/lib/server/adcraft/generate-ad-visual"
import { Database, Tables } from "@/supabase/types"
import {
  AD_FORMAT_STABILITY_MAP,
  AD_FORMATS,
  AdVisualGenerationRequestSchema,
  AdVisualResponse
} from "@/types/adcraft"
import { VALID_ENV_KEYS } from "@/types/valid-keys"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export const runtime = "edge"

export async function POST(request: Request) {
  let jsonBody: any
  try {
    jsonBody = await request.json()
  } catch (err) {
    return NextResponse.json(
      {
        message: "Invalid JSON in request body",
        code: "INVALID_JSON"
      },
      { status: 400 }
    )
  }

  // 1. Authenticate Request via Supabase Session Cookies
  const cookieStore = cookies()
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        }
      }
    }
  )

  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      {
        message: "Authentication required. Please log in to access the Advertisement Studio.",
        code: "UNAUTHENTICATED"
      },
      { status: 401 }
    )
  }

  // 2. Fetch User Profile & Resolve Stability AI API Key (Minimizing columns fetched)
  const { data: rawProfile } = await supabase
    .from("profiles")
    .select("stability_api_key")
    .eq("user_id", user.id)
    .single()

  const profile = rawProfile as { stability_api_key: string | null } | null

  if (!profile) {
    return NextResponse.json(
      {
        message: "User profile not found. Please complete initial setup.",
        code: "PROFILE_NOT_FOUND"
      },
      { status: 404 }
    )
  }

  const stabilityApiKey =
    profile.stability_api_key ||
    process.env[VALID_ENV_KEYS.STABILITY_API_KEY] ||
    process.env.STABILITY_API_KEY ||
    ""

  if (!stabilityApiKey || stabilityApiKey.trim() === "") {
    return NextResponse.json(
      {
        message: "Stability AI API Key not found. Please set your key in Profile Settings.",
        code: "MISSING_API_KEY"
      },
      { status: 400 }
    )
  }

  // 3. Validate Visual Generation Request Parameters with Zod
  const validationResult = AdVisualGenerationRequestSchema.safeParse(jsonBody)

  if (!validationResult.success) {
    const errorDetails = validationResult.error.format()
    const firstErrorMessage =
      validationResult.error.issues[0]?.message || "Invalid visual generation parameters"

    return NextResponse.json(
      {
        message: firstErrorMessage,
        errors: errorDetails,
        code: "VALIDATION_FAILED"
      },
      { status: 400 }
    )
  }

  const validatedRequest = validationResult.data

  // 4. Verify Workspace Authorization (if workspaceId is provided)
  if (validatedRequest.workspaceId) {
    const { data: rawWorkspace, error: wsError } = await supabase
      .from("workspaces")
      .select("id, user_id")
      .eq("id", validatedRequest.workspaceId)
      .maybeSingle()

    const workspace = rawWorkspace as Tables<"workspaces"> | null

    if (wsError || !workspace || workspace.user_id !== user.id) {
      return NextResponse.json(
        {
          message: "Unauthorized: You do not have access to the specified workspace.",
          code: "FORBIDDEN_WORKSPACE"
        },
        { status: 403 }
      )
    }
  }

  // 5. Generate Advertising Background Visual via Stability AI
  const modelId = validatedRequest.model || "stability-image-ultra"

  try {
    const generatedVisual = await generateAdvertisingVisual({
      request: validatedRequest,
      apiKey: stabilityApiKey,
      modelId
    })

    const formatConfig = AD_FORMATS[validatedRequest.format || "square"]
    const stabilityAspectRatio = AD_FORMAT_STABILITY_MAP[validatedRequest.format || "square"]

    const responsePayload: AdVisualResponse = {
      success: true,
      data: {
        image: generatedVisual,
        format: {
          name: formatConfig.name,
          label: formatConfig.label,
          width: formatConfig.width,
          height: formatConfig.height,
          aspectRatio: formatConfig.aspectRatio,
          stabilityAspectRatio
        },
        metadata: {
          model: modelId,
          generatedAt: new Date().toISOString(),
          promptLength: validatedRequest.backgroundPrompt.length
        }
      }
    }

    return NextResponse.json(responsePayload, { status: 200 })
  } catch (error: any) {
    if (error instanceof AdVisualGenerationError) {
      console.error("AdVisualGenerationError:", {
        status: error.status,
        code: error.code,
        message: error.message
      })

      return NextResponse.json(
        {
          message: error.message,
          code: error.code
        },
        { status: error.status }
      )
    }

    console.error("Unexpected advertisement visual generation error:", {
      name: error?.name,
      message: error?.message
    })

    return NextResponse.json(
      {
        message: "An unexpected error occurred while generating advertising visual. Please try again.",
        code: "INTERNAL_ERROR"
      },
      { status: 500 }
    )
  }
}
