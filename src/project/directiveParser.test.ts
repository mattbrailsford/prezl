import { describe, expect, it } from 'vitest'
import { parseDirectives } from './directiveParser'
import { buildScreenIndex } from './stageList'

const STAGES = buildScreenIndex([
  { id: 'main', order: 1 },
  { id: 'shell', order: 2 },
  { id: 'preview', order: 3 },
  { id: 'demo', order: 4 },
])

function parse(source: string, screenId: string) {
  return parseDirectives(source, screenId, STAGES)
}

describe('directive parser', () => {
  describe('emission + line numbering', () => {
    it('strips directive comments and emits the remaining content verbatim', () => {
      const src = [
        '// @prezl id=top',
        'const x = 1',
        'const y = 2',
      ].join('\n')
      const result = parse(src, 'main')
      expect(result.text).toBe('const x = 1\nconst y = 2')
      expect(result.errors).toEqual([])
    })

    it('accepts the @przl short prefix', () => {
      const src = [
        '// @przl id=top',
        'content',
      ].join('\n')
      const result = parse(src, 'main')
      expect(result.text).toBe('content')
      expect(result.marks.top).toBe(1)
    })

    it.each([
      ['// @prezl id=top', 'C-style line'],
      ['# @prezl id=top', 'hash line'],
      ['-- @prezl id=top', 'SQL-style line'],
      ['/* @prezl id=top */', 'C-style block'],
      ['<!-- @prezl id=top -->', 'HTML block'],
      ['@* @prezl id=top *@', 'Razor block'],
    ])('detects directives in %s comments (%s)', (directive) => {
      const src = [directive, 'content'].join('\n')
      const result = parse(src, 'main')
      expect(result.text).toBe('content')
      expect(result.marks.top).toBe(1)
      expect(result.errors).toEqual([])
    })
  })

  describe('file-level gate', () => {
    it('sets hiddenForStage when file=[stages] excludes the current stage', () => {
      const src = [
        '// @prezl file=[preview...]',
        'const x = 1',
      ].join('\n')
      expect(parse(src, 'main').hiddenForStage).toBe(true)
      expect(parse(src, 'shell').hiddenForStage).toBe(true)
      expect(parse(src, 'preview').hiddenForStage).toBe(false)
      expect(parse(src, 'demo').hiddenForStage).toBe(false)
    })

    it('errors when @prezl file appears after code', () => {
      const src = ['const x = 1', '// @prezl file=[shell...]'].join('\n')
      const result = parse(src, 'shell')
      expect(result.errors[0]?.message).toMatch(
        /must appear before any code/,
      )
    })

    it('sets focusedForScreen when sibling focus= matches the current screen', () => {
      const src = [
        '// @prezl file=[shell...] focus=[shell]',
        'const x = 1',
      ].join('\n')
      expect(parse(src, 'shell').focusedForScreen).toBe(true)
      expect(parse(src, 'preview').focusedForScreen).toBe(false)
    })

    it('treats bare focus as "focused on every screen the file is visible"', () => {
      const src = [
        '// @prezl file=[shell...] focus',
        'const x = 1',
      ].join('\n')
      expect(parse(src, 'shell').focusedForScreen).toBe(true)
      expect(parse(src, 'preview').focusedForScreen).toBe(true)
      // Gated out by file= → focus is a no-op even with bare focus.
      expect(parse(src, 'main').focusedForScreen).toBe(false)
    })

    it('drops focusedForScreen when file= hides the file on this screen', () => {
      const src = [
        '// @prezl file=[shell] focus=[main]',
        'const x = 1',
      ].join('\n')
      // File is hidden on `main`, so the focus selector matching there is a no-op.
      const main = parse(src, 'main')
      expect(main.hiddenForStage).toBe(true)
      expect(main.focusedForScreen).toBe(false)
    })

    it('rejects file= with attributes other than focus', () => {
      const src = [
        '// @prezl file=[shell] collapse',
        'const x = 1',
      ].join('\n')
      const result = parse(src, 'shell')
      expect(result.errors[0]?.message).toMatch(/only accepts a sibling focus/)
    })
  })

  describe('show', () => {
    it('removes the region entirely when stages do not match', () => {
      const src = [
        'a',
        '// @prezl show=[preview...]',
        'b',
        'c',
        '// @prezl end',
        'd',
      ].join('\n')
      expect(parse(src, 'main').text).toBe('a\nd')
      expect(parse(src, 'preview').text).toBe('a\nb\nc\nd')
    })

    it('shifts line numbers when the region is dropped', () => {
      const src = [
        'a',
        '// @prezl show=[preview...]',
        'b',
        '// @prezl end',
        '// @prezl id=here',
        'c',
      ].join('\n')
      // on main, `b` is dropped → mark lands on rendered line 2
      expect(parse(src, 'main').marks.here).toBe(2)
      // on preview, mark lands on rendered line 3 (a, b, c)
      expect(parse(src, 'preview').marks.here).toBe(3)
    })
  })

  describe('collapse', () => {
    it('bare collapse folds on every stage', () => {
      const src = [
        'a',
        '// @prezl collapse label="Guts"',
        'b',
        'c',
        '// @prezl end',
      ].join('\n')
      const result = parse(src, 'main')
      expect(result.foldRanges).toEqual([
        { start: 2, end: 3, label: 'Guts', indent: '' },
      ])
    })

    it('captures the directive line indent on the fold range', () => {
      const src = [
        'function outer() {',
        '  // @prezl collapse label="body"',
        '      const x = 1',
        '      const y = 2',
        '  // @prezl end',
        '}',
      ].join('\n')
      // The placeholder sits where the opening `@prezl` directive was, not
      // where the first content line is — so two spaces, not six.
      const result = parse(src, 'main')
      expect(result.foldRanges[0]?.indent).toBe('  ')
    })

    it('stage-gated collapse only emits folds on matching stages', () => {
      const src = [
        'a',
        '// @prezl collapse=[shell]',
        'b',
        '// @prezl end',
      ].join('\n')
      expect(parse(src, 'shell').foldRanges).toHaveLength(1)
      expect(parse(src, 'preview').foldRanges).toHaveLength(0)
    })
  })

  describe('focus', () => {
    it('emits focus ranges only on matching stages', () => {
      const src = [
        '// @prezl focus=[shell]',
        'highlighted',
        '// @prezl end',
      ].join('\n')
      expect(parse(src, 'shell').focusRanges).toEqual([{ start: 1, end: 1 }])
      expect(parse(src, 'preview').focusRanges).toEqual([])
    })

    it('bare focus highlights on every stage', () => {
      const src = [
        '// @prezl focus',
        'highlighted',
        '// @prezl end',
      ].join('\n')
      expect(parse(src, 'main').focusRanges).toEqual([{ start: 1, end: 1 }])
      expect(parse(src, 'shell').focusRanges).toEqual([{ start: 1, end: 1 }])
      expect(parse(src, 'preview').focusRanges).toEqual([{ start: 1, end: 1 }])
    })

    it('trims leading and trailing blank lines from the focus range', () => {
      const src = [
        '// @prezl focus',
        '',
        '  ',
        'highlighted',
        '',
        '// @prezl end',
      ].join('\n')
      // emitted lines: "", "  ", "highlighted", ""
      expect(parse(src, 'main').focusRanges).toEqual([{ start: 3, end: 3 }])
    })

    it('drops the focus range entirely when the body is all whitespace', () => {
      const src = [
        '// @prezl focus',
        '',
        '   ',
        '// @prezl end',
      ].join('\n')
      expect(parse(src, 'main').focusRanges).toEqual([])
    })
  })

  describe('stacked attributes', () => {
    it('allows show + focus + collapse on one directive', () => {
      const src = [
        '// @prezl id=heavy show=[preview...] focus=[preview] collapse label="Heavy"',
        'body',
        '// @prezl end',
      ].join('\n')
      const preview = parse(src, 'preview')
      expect(preview.text).toBe('body')
      expect(preview.foldRanges).toEqual([
        { start: 1, end: 1, label: 'Heavy', indent: '' },
      ])
      expect(preview.focusRanges).toEqual([{ start: 1, end: 1 }])
      expect(preview.marks.heavy).toBe(1)
    })

    it('drops the entire region (and its nested directives) when outer show excludes the stage', () => {
      const src = [
        '// @prezl show=[preview...]',
        '  // @prezl focus=[shell]',
        '  x',
        '  // @prezl end',
        '// @prezl end',
      ].join('\n')
      const shell = parse(src, 'shell')
      expect(shell.text).toBe('')
      expect(shell.focusRanges).toEqual([])
      expect(shell.errors).toEqual([])
    })
  })

  describe('end matching', () => {
    it('accepts bare end that pops the most recent open', () => {
      const src = [
        '// @prezl focus=[main]',
        'x',
        '// @prezl end',
      ].join('\n')
      const result = parse(src, 'main')
      expect(result.errors).toEqual([])
      expect(result.focusRanges).toEqual([{ start: 1, end: 1 }])
    })

    it('accepts end=id that matches the open id', () => {
      const src = [
        '// @prezl id=outer show=[main]',
        'x',
        '// @prezl end=outer',
      ].join('\n')
      expect(parse(src, 'main').errors).toEqual([])
    })

    it('errors on mismatched end=id but still pops', () => {
      const src = [
        '// @prezl id=outer show=[main]',
        'x',
        '// @prezl end=wrong',
      ].join('\n')
      const result = parse(src, 'main')
      expect(result.errors[0]?.message).toMatch(/does not match open id=outer/)
    })

    it('errors on unclosed opens', () => {
      const src = [
        '// @prezl id=outer focus=[main]',
        'x',
      ].join('\n')
      const result = parse(src, 'main')
      expect(result.errors[0]?.message).toMatch(/was never closed/)
    })

    it('errors on orphan end', () => {
      const src = ['// @prezl end'].join('\n')
      const result = parse(src, 'main')
      expect(result.errors[0]?.message).toMatch(
        /@prezl end with no matching open/,
      )
    })
  })

  describe('anchors (id-only)', () => {
    it('resolves a pure id directive to the next emitted line', () => {
      const src = [
        '// @prezl id=target',
        '',
        'real line',
      ].join('\n')
      const result = parse(src, 'main')
      // blank after the directive is emitted first
      expect(result.marks.target).toBe(1)
    })

    it('an id on a region directive anchors the first content line', () => {
      const src = [
        '// @prezl id=fn focus=[main]',
        'body',
        '// @prezl end',
      ].join('\n')
      expect(parse(src, 'main').marks.fn).toBe(1)
    })
  })
})
