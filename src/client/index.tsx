/** 在本体的插件管理页面提供开关、各模式状态和部署预览。 */
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
// Type-only: the renderer provides the ctx.slots service used for registration.
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: 本插件配置所在的原生槽位。
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import type { Context } from '@deepseek-ai/cordis'
import { createUnrestrictedController } from './controller.ts'
import { en, NS, zh, type UnrestrictedLocaleKey } from './locales.ts'
import { ensureStyles } from './styles.ts'
import { UnrestrictedCard } from './UnrestrictedCard.tsx'
import { SessionToggle } from './SessionToggle.tsx'
import type { UnrestrictedSettings } from './controller.ts'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Unrestricted mode copy. */
    'settings.unrestricted': UnrestrictedLocaleKey
  }
}

/** Services required by the registration and the controller. */
export const inject = ['slots', 'locale', 'connection', 'remote', 'configForms']

/** 注册本插件的配置卡片。 */
export function apply(ctx: Context): void {
  ctx.effect(() => ensureStyles(), 'dsh-unrestricted: stylesheet')
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-unrestricted: dictionaries')
  const controller = createUnrestrictedController(ctx)
  ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
    name: 'plugins.bundle.config',
    key: 'dsh-unrestricted',
    locale: NS,
    inject: () => controller.face(),
  }, UnrestrictedCard))
  ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
    name: 'conversation.input.left',
    id: 'dsh-unrestricted-session',
    order: 100,
    locale: NS,
    inject: (sessionId) => ({
      sessionId,
      settings: ctx.configForms.get<UnrestrictedSettings>('unrestricted'),
      read: async () => {
        const connection = ctx.get('connection') as ConnectionHandle
        const result = await connection.rpc.call('/api', 'dsh-unrestricted/session-status', { sessionId }) as
          { ok: true; value: { enabled: boolean } } | { ok: false; error: { message: string } }
        if (!result.ok) throw new Error(result.error.message)
        return result.value.enabled
      },
    }),
  }, SessionToggle))
}
