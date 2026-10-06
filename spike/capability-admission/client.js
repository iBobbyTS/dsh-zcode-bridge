/**
 * Capability admission spike — browser half.
 *
 * Registers into the official DSH slots cited by the capability admission task packet and marks
 * the DOM with `data-capability-admission-*` attributes so an HTTP/DOM harness can verify what
 * actually rendered on a running instance. No model call, no session creation.
 */
window.__ModuleLoader__.load({
  id: '@dsh-zcode/capability-admission',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        const doc = document.documentElement
        doc.dataset.capabilityAdmissionSpikeMounted = String(Number(doc.dataset.capabilityAdmissionSpikeMounted ?? 0) + 1)
        ctx.effect(() => ctx.locale.register('capabilityAdmissionSpike', {
          en: { runtime: 'Runtime', approval: 'Mock approval', approve: 'Allow', reject: 'Reject', settings: 'Zcode Bridge' },
          zh: { runtime: 'Runtime', approval: 'Mock approval', approve: 'Allow', reject: 'Reject', settings: 'Zcode Bridge' },
        }))

        // ② runtime selection in the model/strength seat (single, session scope,
        // replaceRisk: shadows-shipped-ui). A dynamic entry is assigned a priority
        // lower than the shipped ModelSelect, so this entry is the one that renders.
        ctx.slots.inject('conversation.input.model', () => ctx.slots.register({
          // Single-slot shadowing: the shipped ModelSelect registers at priority 0,
          // so a lower priority is the winner the owner renders.
          name: 'conversation.input.model', priority: -1, locale: 'capabilityAdmissionSpike',
        }, ({ locked, t }) => h('div', { 'data-capability-admission-runtime-seat': '', role: 'group', 'aria-label': t('runtime') },
          h('select', {
            'data-capability-admission-runtime-select': '', defaultValue: 'zcode', disabled: locked === true,
            'aria-label': t('runtime'),
          }, h('option', { value: 'zcode' }, 'ZCode'), h('option', { value: 'dsh' }, 'DSH')))))

        // ③ leading decoration of a Session row (list). Suppressed whenever the
        // row has a higher-priority status (pending interaction / activity / unread).
        ctx.slots.inject('sidebar.session.row.leading', () => ctx.slots.register({
          name: 'sidebar.session.row.leading', id: 'capability-admission-owner-leading', order: 1,
        }, () => h('span', { 'data-capability-admission-leading': '', title: 'ZCode runtime', style: { fontSize: 11 } }, 'Z')))

        // ③ trailing hover action buttons (list). Mounted in the row actions strip,
        // which CSS shows on row hover or while the "..." menu is open.
        ctx.slots.inject('sidebar.workspaces.session.row.action', () => ctx.slots.register({
          name: 'sidebar.workspaces.session.row.action', id: 'capability-admission-owner-trailing', order: 1,
        }, () => h('button', {
          type: 'button', 'data-capability-admission-trailing': '', title: 'ZCode runtime',
          onClick: event => event.stopPropagation(),
        }, 'Z')))

        // ④ approval display seat: conversation.composer is a chain routed by a
        // selector (ui-approval uses exactly this to show a pending approval).
        // Returning a non-null match forces the mock panel to render, proving the
        // display seam without any real approval or model call.
        ctx.slots.inject('conversation.composer', () => ctx.slots.register({
          name: 'conversation.composer', priority: -1, locale: 'capabilityAdmissionSpike',
          select: () => ({ mock: 'capability-admission' }),
        }, ({ t }) => h('div', { 'data-capability-admission-mock-approval': '', role: 'group', 'aria-label': t('approval') },
          h('span', null, t('approval') + ': '),
          h('button', {
            type: 'button', 'data-capability-admission-approve': '',
            onClick: () => { doc.dataset.capabilityAdmissionApproval = 'allowed-once' },
          }, t('approve')),
          h('button', {
            type: 'button', 'data-capability-admission-reject': '',
            onClick: () => { doc.dataset.capabilityAdmissionApproval = 'rejected' },
          }, t('reject')))))

        // ⑦ settings module seam: settings.section is the additive list seat.
        ctx.slots.inject('settings.section', () => ctx.slots.register({
          name: 'settings.section', id: 'zcode-bridge', order: 500, label: 'Zcode Bridge', locale: 'capabilityAdmissionSpike',
        }, ({ t }) => h('div', { 'data-capability-admission-settings': '' }, t('settings'))))

        // Additive overlay marker (list slot): proves list seats are additive and
        // gives the harness an always-mounted load signal.
        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay', id: 'capability-admission-marker',
        }, () => h('span', { 'data-capability-admission-overlay': '', 'aria-hidden': true, style: { display: 'none' } }, 'capability-admission')))
      },
    }
  },
})
