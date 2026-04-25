import { describe, it, expect } from 'vitest'
import { buildDeepLink, parseDeepLink } from './deepLink'

describe('parseDeepLink', () => {
  it('parses path-only URL', () => {
    expect(parseDeepLink('prezl://open?path=D%3A%5Ctalks%5Cdemo')).toEqual({
      path: 'D:\\talks\\demo',
      screen: undefined,
      fullscreen: false,
      hideOnExit: false,
    })
  })

  it('parses full URL with screen + flags', () => {
    expect(
      parseDeepLink(
        'prezl://open?path=%2Fhome%2Fme%2Fproj&screen=preview.intro&fullscreen=1&hideOnExit=1',
      ),
    ).toEqual({
      path: '/home/me/proj',
      screen: 'preview.intro',
      fullscreen: true,
      hideOnExit: true,
    })
  })

  it('rejects URLs without path', () => {
    expect(parseDeepLink('prezl://open?fullscreen=1')).toBeNull()
  })

  it('rejects non-prezl schemes', () => {
    expect(parseDeepLink('https://example.com/?path=foo')).toBeNull()
  })

  it('rejects unknown actions', () => {
    expect(parseDeepLink('prezl://eval?path=foo')).toBeNull()
  })

  it('returns null on garbage input', () => {
    expect(parseDeepLink('not a url')).toBeNull()
  })

  it('round-trips with buildDeepLink', () => {
    const params = {
      path: 'D:\\talks\\demo',
      screen: 'preview.intro',
      fullscreen: true,
      hideOnExit: true,
    }
    const url = buildDeepLink(params)
    expect(parseDeepLink(url)).toEqual(params)
  })

  it('omits unset flags from the URL', () => {
    const url = buildDeepLink({ path: '/foo' })
    expect(url).toBe('prezl://open?path=%2Ffoo')
  })
})
