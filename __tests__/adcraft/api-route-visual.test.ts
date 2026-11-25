/**
 * @jest-environment node
 */

import { POST } from "@/app/api/adcraft/generate-visual/route"
import { AdVisualGenerationError } from "@/lib/server/adcraft/generate-ad-visual"
import * as ssrModule from "@supabase/ssr"

// Mock dependencies
jest.mock("@supabase/ssr")
jest.mock("next/headers", () => ({
  cookies: jest.fn(() => ({
    get: jest.fn()
  }))
}))

const mockGenerateAdvertisingVisual = jest.fn()
jest.mock("../../lib/server/adcraft/generate-ad-visual", () => {
  const actual = jest.requireActual("../../lib/server/adcraft/generate-ad-visual")
  return {
    ...actual,
    generateAdvertisingVisual: (...args: any[]) => mockGenerateAdvertisingVisual(...args)
  }
})

describe("POST /api/adcraft/generate-visual API Route", () => {
  const mockUser = { id: "user-456", email: "creator@adcraft.ai" }
  const mockProfile = {
    user_id: "user-456",
    stability_api_key: "test-stability-key-123"
  }

  const validRequestBody = {
    backgroundPrompt:
      "A serene minimalist wooden table with soft morning sunshine beaming through high windows, airy modern architectural kitchen background, clean negative space in center for product placement, commercial studio lighting, no text, no words",
    format: "square",
    model: "stability-image-ultra"
  }

  const mockBase64Image =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

  const mockGeneratedVisual = {
    base64: mockBase64Image,
    dataUrl: `data:image/webp;base64,${mockBase64Image}`,
    format: "webp" as const,
    aspectRatio: "1:1",
    finishReason: "SUCCESS",
    seed: 987654
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

  it("returns 401 when request is unauthenticated (no Supabase session)", async () => {
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

  it("returns 400 when Stability AI API key is not configured", async () => {
    const profileWithoutKey = { ...mockProfile, stability_api_key: "" }
    const originalEnvKey = process.env.STABILITY_API_KEY
    delete process.env.STABILITY_API_KEY

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
      process.env.STABILITY_API_KEY = originalEnvKey
    }
  })

  it("returns 400 when input validation fails (backgroundPrompt too short)", async () => {
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

    const invalidBody = { ...validRequestBody, backgroundPrompt: "No" }
    const request = {
      json: jest.fn().mockResolvedValue(invalidBody)
    } as unknown as Request

    const response = await POST(request)
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.code).toBe("VALIDATION_FAILED")
    expect(json.message).toContain("at least 5 characters")
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
      model: "midjourney-v6"
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

  it("returns 403 when user is not authorized to access the provided workspaceId", async () => {
    const targetWorkspaceId = "22222222-3333-4444-5555-666666666666"

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
            // Workspace owned by someone else!
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

  it("returns 200 with structured visual response and verifies minimized profile select", async () => {
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

    mockGenerateAdvertisingVisual.mockResolvedValue(mockGeneratedVisual)

    const request = {
      json: jest.fn().mockResolvedValue(validRequestBody)
    } as unknown as Request

    const response = await POST(request)
    expect(response.status).toBe(200)

    // Verify minimal profile query (only stability_api_key requested)
    expect(mockSelect).toHaveBeenCalledWith("stability_api_key")

    const json = await response.json()
    expect(json.success).toBe(true)
    expect(json.data.image.base64).toBe(mockGeneratedVisual.base64)
    expect(json.data.image.dataUrl).toBe(mockGeneratedVisual.dataUrl)
    expect(json.data.format.name).toBe("square")
    expect(json.data.format.width).toBe(1080)
    expect(json.data.format.height).toBe(1080)
    expect(json.data.format.stabilityAspectRatio).toBe("1:1")
    expect(json.data.metadata.model).toBe("stability-image-ultra")
  })

  it("propagates sanitized AdVisualGenerationError status and message on upstream failure", async () => {
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

    mockGenerateAdvertisingVisual.mockRejectedValue(
      new AdVisualGenerationError(
        "Stability AI rate limit reached or credits exhausted. Please verify your Stability account balance or try again later.",
        429,
        "RATE_LIMIT_OR_CREDITS_EXHAUSTED"
      )
    )

    const request = {
      json: jest.fn().mockResolvedValue(validRequestBody)
    } as unknown as Request

    const response = await POST(request)
    expect(response.status).toBe(429)
    const json = await response.json()
    expect(json.code).toBe("RATE_LIMIT_OR_CREDITS_EXHAUSTED")
    expect(json.message).toContain("rate limit reached or credits exhausted")
  })
})
