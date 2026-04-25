import { z } from 'zod'

const projectFolder = z.object({
  name: z.string().min(1),
  path: z.string().min(1),
  icon: z.string().optional(),
  /** Color family override. Any key in PROJECT_PALETTE (violet, sky,
   *  yellow, orange, emerald, cyan, red, indigo, pink, amber, slate).
   *  Falls back to the icon's default mapping, then to the generic
   *  --color-project-accent. */
  color: z.string().optional(),
})

const openTarget = z.object({
  file: z.string().min(1),
  line: z.number().int().positive().optional(),
  id: z.string().min(1).optional(),
})

const symbolTarget = z.object({
  file: z.string().min(1),
  line: z.number().int().positive().optional(),
  id: z.string().min(1).optional(),
})

const urlPreview = z.object({
  type: z.literal('url'),
  src: z.string().url().or(z.string().regex(/^\.{0,2}\//)),
  mode: z.enum(['external', 'window', 'pane']).optional(),
})

const videoCue = z.object({
  time: z.number().nonnegative(),
  label: z.string().optional(),
})

const videoPreview = z.object({
  type: z.literal('video'),
  src: z.string().min(1),
  startAt: z.number().nonnegative().optional(),
  stopAt: z.number().nonnegative().optional(),
  cues: z.array(videoCue).optional(),
})

const preview = z.discriminatedUnion('type', [urlPreview, videoPreview])

const stage = z.object({
  alias: z.string().min(1),
  branch: z.string().min(1).optional(),
  title: z.string().optional(),
  open: openTarget.optional(),
  symbols: z.record(z.string(), symbolTarget).optional(),
  preview: preview.optional(),
})

export const prezlProjectSchema = z.object({
  name: z.string().min(1),
  projects: z.array(projectFolder).optional(),
  stages: z.array(stage).min(1),
})

export type PrezlProjectParsed = z.infer<typeof prezlProjectSchema>

export type LoadError = {
  kind: 'parse' | 'validation' | 'io'
  message: string
  issues?: { path: string; message: string }[]
  line?: number
  column?: number
}
