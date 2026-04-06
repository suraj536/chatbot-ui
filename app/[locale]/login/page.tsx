import { Brand } from "@/components/ui/brand"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SubmitButton } from "@/components/ui/submit-button"
import { createClient } from "@/lib/supabase/server"
import { Database } from "@/supabase/types"
import { createServerClient } from "@supabase/ssr"
import { get } from "@vercel/edge-config"
import { Metadata } from "next"
import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Login"
}

export default async function Login({
  searchParams
}: {
  searchParams: { message: string }
}) {
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
    data: { session }
  } = await supabase.auth.getSession()

  // ========================
  // ✅ HANDLE EXISTING SESSION (FIXED ERROR)
  // ========================
  if (session) {
    const { data: homeWorkspace } = await supabase
      .from("workspaces")
      .select("id") // ✅ IMPORTANT FIX (avoid JSON error)
      .eq("user_id", session.user.id)
      .eq("is_home", true)
      .limit(1)
      .maybeSingle()

    if (!homeWorkspace) {
      return redirect("/setup")
    }

    return redirect(`/${homeWorkspace.id}/chat`)
  }

  // ========================
  // ✅ SIGN IN
  // ========================
  const signIn = async (formData: FormData) => {
    "use server"

    const email = formData.get("email") as string
    const password = formData.get("password") as string

    const cookieStore = cookies()
    const supabase = createClient(cookieStore)

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      return redirect(`/login?message=${error.message}`)
    }

    const { data: homeWorkspace } = await supabase
      .from("workspaces")
      .select("id") // ✅ FIXED
      .eq("user_id", data.user.id)
      .eq("is_home", true)
      .limit(1)
      .maybeSingle()

    if (!homeWorkspace) {
      return redirect("/setup")
    }

    return redirect(`/${homeWorkspace.id}/chat`)
  }

  // ========================
  // ENV HELPER
  // ========================
  const getEnvVarOrEdgeConfigValue = async (name: string) => {
    "use server"
    if (process.env.EDGE_CONFIG) {
      return await get<string>(name)
    }
    return process.env[name]
  }

  // ========================
  // ✅ SIGN UP
  // ========================
  const signUp = async (formData: FormData) => {
    "use server"

    const email = formData.get("email") as string
    const password = formData.get("password") as string

    const emailDomainWhitelistPatternsString =
      await getEnvVarOrEdgeConfigValue("EMAIL_DOMAIN_WHITELIST")

    const emailDomainWhitelist = emailDomainWhitelistPatternsString?.trim()
      ? emailDomainWhitelistPatternsString.split(",")
      : []

    const emailWhitelistPatternsString =
      await getEnvVarOrEdgeConfigValue("EMAIL_WHITELIST")

    const emailWhitelist = emailWhitelistPatternsString?.trim()
      ? emailWhitelistPatternsString.split(",")
      : []

    if (emailDomainWhitelist.length > 0 || emailWhitelist.length > 0) {
      const domainMatch = emailDomainWhitelist.includes(email.split("@")[1])
      const emailMatch = emailWhitelist.includes(email)

      if (!domainMatch && !emailMatch) {
        return redirect(
          `/login?message=Email ${email} is not allowed to sign up.`
        )
      }
    }

    const cookieStore = cookies()
    const supabase = createClient(cookieStore)

    const { error } = await supabase.auth.signUp({
      email,
      password
    })

    if (error) {
      return redirect(`/login?message=${error.message}`)
    }

    return redirect("/setup")
  }

  // ========================
  // RESET PASSWORD
  // ========================
  const handleResetPassword = async (formData: FormData) => {
    "use server"

    const origin = headers().get("origin")
    const email = formData.get("email") as string

    const cookieStore = cookies()
    const supabase = createClient(cookieStore)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/login/password`
    })

    if (error) {
      return redirect(`/login?message=${error.message}`)
    }

    return redirect("/login?message=Check email to reset password")
  }

  // ========================
  // UI
  // ========================
  return (
    <div className="flex w-full flex-1 flex-col justify-center gap-2 px-8 sm:max-w-md">
      <form
        className="animate-in text-foreground flex w-full flex-1 flex-col justify-center gap-2"
        action={signIn}
      >
        <Brand />

        <Label className="text-md mt-4">Email</Label>
        <Input name="email" placeholder="you@example.com" required />

        <Label className="text-md">Password</Label>
        <Input type="password" name="password" placeholder="••••••••" />

        <SubmitButton className="bg-blue-700 text-white">
          Login
        </SubmitButton>

        <SubmitButton formAction={signUp}>
          Sign Up
        </SubmitButton>

        <div className="text-sm text-center">
          <span>Forgot your password?</span>
          <button formAction={handleResetPassword} className="underline ml-1">
            Reset
          </button>
        </div>

        {searchParams?.message && (
          <p className="mt-4 p-2 text-center bg-gray-200">
            {searchParams.message}
          </p>
        )}
      </form>
    </div>
  )
}