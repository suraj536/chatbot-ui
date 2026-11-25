/**
 * @jest-environment node
 */

import { POST } from "@/app/api/adcraft/generate-copy/route"
import { AdCopyGenerationError } from "@/lib/server/adcraft/generate-ad-copy"
import * as ssrModule from "@supabase/ssr"

// Mock dependencies
jest.mock("@supabase/ssr")
jest.mock("next/headers", () => ({
  cookies: jest.fn(() => ({
    get: jest.fn()
  }))
}))

const mockGenerateAdvertisingCopy = jest.fn()
jest.mock("../../lib/server/adcraft/generate-ad-copy", () => {
  const actual = jest.requireActual("../../lib/server/adcraft/generate-ad-copy")
  return {
    ...actual,
    generateAdvertisingCopy: (...args: any[]) => mockGenerateAdvertisingCopy(...args)
  }
})

describe("POST /api/adcraft/generate-copy API Route", () => {
  const mockUser = { id: "user-123", email: "user@adcraft.ai" }
  const mockProfile = {
    user_id: "user-123",
    google_gemini_api_key: "test-gemini-key"
  }

  const validRequestBody = {
    productName: "EcoFlask Thermos",
    productDescription:
      "Vacuum-insulated stainless steel water bottle that keeps drinks cold for 24 hours.",
    price: "$29.99",
    offer: "Buy 1 Get 1 20% Off",
    platform: "instagram",
    tone: "casual",
    format: "square"
  }

  const mockGeneratedCopy = {
    headline: "Ice Cold for 24 Hours",
    primaryText:
      "Stay hydrated on every adventure with EcoFlask. Vacuum-insulated stainless steel keeps drinks freezing cold all day.",
    description: "Premium insulated 24-hour hydration flask.",
    callToAction: "Order EcoFlask Today",
    visualDirection:
      "Sleek metallic flask placed on a weathered granite boulder in a sunlit alpine landscape.",
    backgroundPrompt:
      "Commercial photography of sunlit alpine granite boulder, morning light, blurred evergreen forest in background, studio lighting, clean center space, no text, no words",
    suggestedLayout: {
      textPlacement: "top",
      productPlacement: "center",
      colorPaletteSuggestion: ["#0055A5", "#FFFFFF"]
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns 400 when request body contains invalid JSON", async () => {
    const invalidRequest = {
      json: jest.fn().mockRejectedValue(new Error("SyntaxError: Unexpected token"))
    } as unknown as Request

    const response = await POST(invalidRequest)
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.code).toBe("INVALID_JSON")
  })

  it("returns 401 when request is unauthenticated (no Supabase user session)", async () => {
    const mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: null },
          error: new Error("No session found")
        })
      }
    }
    ;(ssrModule.createServerClient as jest.Mock).mockReturnValue(mockSupabase)

    const request = {
      json: jest.fn().mockResolvedValue(validRequestBody)
    } as unknown as Request

    const response = await POST(request)
    expect(response.status).toBe(401)
    const json = await response.json()
    expect(json.code).toBe("UNAUTHENTICATED")
  })

  it("returns 404 when user profile cannot be found in database", async () => {
    const mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null
        })
      },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null })
      })
    }
    ;(ssrModule.createServerClient as jest.Mock).mockReturnValue(mockSupabase)

    const request = {
      json: jest.fn().mockResolvedValue(validRequestBody)
    } as unknown as Request

    const response = await POST(request)
    expect(response.status).toBe(404)
    const json = await response.json()
    expect(json.code).toBe("PROFILE_NOT_FOUND")
  })

  it("returns 400 when Google Gemini API key is not configured", async () => {
    const profileWithoutKey = { ...mockProfile, google_gemini_api_key: "" }
    const originalEnvKey = process.env.GOOGLE_GEMINI_API_KEY
    delete process.env.GOOGLE_GEMINI_API_KEY

    const mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null
        })
      },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: profileWithoutKey, error: null })
      })
    }
    ;(ssrModule.createServerClient as jest.Mock).mockReturnValue(mockSupabase)

    const request = {
      json: jest.fn().mockResolvedValue(validRequestBody)
    } as unknown as Request

    const response = await POST(request)
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.code).toBe("MISSING_API_KEY")

    if (originalEnvKey) {
      process.env.GOOGLE_GEMINI_API_KEY = originalEnvKey
    }
  })

  it("returns 400 when input validation fails (missing required productName)", async () => {
    const mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null
        })
      },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockProfile, error: null })
      })
    }
    ;(ssrModule.createServerClient as jest.Mock).mockReturnValue(mockSupabase)

    const invalidBody = { ...validRequestBody, productName: "" }
    const request = {
      json: jest.fn().mockResolvedValue(invalidBody)
    } as unknown as Request

    const response = await POST(request)
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.code).toBe("VALIDATION_FAILED")
  })

  it("returns 403 when user is not authorized to access the provided workspaceId", async () => {
    const targetWorkspaceId = "11111111-2222-3333-4444-555555555555"

    const mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null
        })
      },
      from: jest.fn((table: string) => {
        if (table === "profiles") {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: mockProfile, error: null })
          }
        }
        if (table === "workspaces") {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            // Workspace owned by a different user!
            maybeSingle: jest.fn().mockResolvedValue({
              data: { id: targetWorkspaceId, user_id: "other-user-999" },
              error: null
            })
          }
        }
        return {}
      })
    }
    ;(ssrModule.createServerClient as jest.Mock).mockReturnValue(mockSupabase)

    const requestWithWorkspace = {
      ...validRequestBody,
      workspaceId: targetWorkspaceId
    }

    const request = {
      json: jest.fn().mockResolvedValue(requestWithWorkspace)
    } as unknown as Request

    const response = await POST(request)
    expect(response.status).toBe(403)
    const json = await response.json()
    expect(json.code).toBe("FORBIDDEN_WORKSPACE")
  })

  it("returns 200 with structured ad copy response on successful execution and verifies minimized profile select", async () => {
    const mockSelect = jest.fn().mockReturnThis()
    const mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null
        })
      },
      from: jest.fn().mockReturnValue({
        select: mockSelect,
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockProfile, error: null })
      })
    }
    ;(ssrModule.createServerClient as jest.Mock).mockReturnValue(mockSupabase)

    mockGenerateAdvertisingCopy.mockResolvedValue(mockGeneratedCopy)

    const request = {
      json: jest.fn().mockResolvedValue(validRequestBody)
    } as unknown as Request

    const response = await POST(request)
    expect(response.status).toBe(200)

    // Verify minimal profile query (only google_gemini_api_key requested)
    expect(mockSelect).toHaveBeenCalledWith("google_gemini_api_key")

    const json = await response.json()
    expect(json.success).toBe(true)
    expect(json.data.copy.headline).toBe(mockGeneratedCopy.headline)
    expect(json.data.copy.callToAction).toBe(mockGeneratedCopy.callToAction)
    expect(json.data.platform).toBe("instagram")
    expect(json.data.format.width).toBe(1080)
    expect(json.data.format.height).toBe(1080)
    expect(json.data.metadata.productName).toBe(validRequestBody.productName)
  })

  it("returns 400 when model ID is not supported", async () => {
    const mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null
        })
      },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockProfile, error: null })
      })
    }
    ;(ssrModule.createServerClient as jest.Mock).mockReturnValue(mockSupabase)

    const invalidModelBody = {
      ...validRequestBody,
      model: "claude-3-opus"
    }
    const request = {
      json: jest.fn().mockResolvedValue(invalidModelBody)
    } as unknown as Request

    const response = await POST(request)
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.code).toBe("VALIDATION_FAILED")
    expect(json.message).toContain("Model must be one of")
  })

  it("propagates sanitized AdCopyGenerationError status and message on upstream failure", async () => {
    const mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: mockUser },
          error: null
        })
      },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockProfile, error: null })
      })
    }
    ;(ssrModule.createServerClient as jest.Mock).mockReturnValue(mockSupabase)

    mockGenerateAdvertisingCopy.mockRejectedValue(
      new AdCopyGenerationError(
        "Google Gemini rate limit reached or quota exhausted. Please check your account quota or try again later.",
        429,
        "RATE_LIMIT_EXCEEDED"
      )
    )

    const request = {
      json: jest.fn().mockResolvedValue(validRequestBody)
    } as unknown as Request

    const response = await POST(request)
    expect(response.status).toBe(429)
    const json = await response.json()
    expect(json.code).toBe("RATE_LIMIT_EXCEEDED")
    expect(json.message).toBe(
      "Google Gemini rate limit reached or quota exhausted. Please check your account quota or try again later."
    )
  })
})
