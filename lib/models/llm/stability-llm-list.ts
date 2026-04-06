import { LLM } from "@/types"

const STABILITY_PLATFORM_LINK = "https://platform.stability.ai/"

const STABILITY_VIDEO: LLM = {
  modelId: "stability-video",
  modelName: "Stability AI Video",
  provider: "stability" as any,
  hostedId: "stability-video",
  platformLink: STABILITY_PLATFORM_LINK,
  imageInput: false
}

export const STABILITY_LLM_LIST: LLM[] = [STABILITY_VIDEO]