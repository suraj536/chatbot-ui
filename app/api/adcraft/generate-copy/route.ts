import {
  AdCopyGenerationError,
  generateAdvertisingCopy
} from "@/lib/server/adcraft/generate-ad-copy"
import { Database, Tables } from "@/supabase/types"
import {
  AD_FORMATS,
  AdCopyResponse,
  AdGenerationRequestSchema
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

  // 2. Fetch User Profile & Resolve Gemini API Key (Minimizing columns fetched)
  const { data: rawProfile } = await supabase
    .from("profiles")
    .select("google_gemini_api_key")
    .eq("user_id", user.id)
    .single()

  const profile = rawProfile as { google_gemini_api_key: string | null } | null

  if (!profile) {
    return NextResponse.json(
      {
        message: "User profile not found. Please complete initial setup.",
        code: "PROFILE_NOT_FOUND"
      },
      { status: 404 }
    )
  }

  const geminiApiKey =
    profile.google_gemini_api_key ||
    process.env[VALID_ENV_KEYS.GOOGLE_GEMINI_API_KEY] ||
    ""

  if (!geminiApiKey || geminiApiKey.trim() === "") {
    return NextResponse.json(
      {
        message: "Google Gemini API Key not found. Please set your key in Profile Settings.",
        code: "MISSING_API_KEY"
      },
      { status: 400 }
    )
  }

  // 3. Validate Advertising Request Parameters with Zod
  const validationResult = AdGenerationRequestSchema.safeParse(jsonBody)

  if (!validationResult.success) {
    const errorDetails = validationResult.error.format()
    const firstErrorMessage =
      validationResult.error.issues[0]?.message || "Invalid advertising request parameters"

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

  // 5. Generate Structured Advertising Copy via Gemini
  const modelId = validatedRequest.model || "gemini-2.0-flash"

  try {
    const generatedCopy = await generateAdvertisingCopy({
      request: validatedRequest,
      apiKey: geminiApiKey,
      modelId
    })

    const formatConfig = AD_FORMATS[validatedRequest.format || "square"]

    const responsePayload: AdCopyResponse = {
      success: true,
      data: {
        copy: generatedCopy,
        platform: validatedRequest.platform,
        format: {
          name: formatConfig.name,
          label: formatConfig.label,
          width: formatConfig.width,
          height: formatConfig.height,
          aspectRatio: formatConfig.aspectRatio
        },
        metadata: {
          model: modelId,
          generatedAt: new Date().toISOString(),
          productName: validatedRequest.productName,
          brandName: validatedRequest.brandName
        }
      }
    }

    return NextResponse.json(responsePayload, { status: 200 })
  } catch (error: any) {
    if (error instanceof AdCopyGenerationError) {
      console.error("AdCopyGenerationError:", {
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

    console.error("Unexpected advertisement copy generation error:", {
      name: error?.name,
      message: error?.message
    })

    return NextResponse.json(
      {
        message: "An unexpected error occurred while generating advertising copy. Please try again.",
        code: "INTERNAL_ERROR"
      },
      { status: 500 }
    )
  }
}
