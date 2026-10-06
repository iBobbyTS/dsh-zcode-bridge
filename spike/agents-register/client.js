/**
 * Agents-register probe — browser half.
 *
 * Only an always-mounted marker so the DOM probe can confirm the bundle's
 * client half loaded. The coexistence proof is entirely host-driven: official
 * UI renders both the native session and the registered mock zcode session.
 */
window.__ModuleLoader__.load({
  id: '@dsh-zcode/agents-register',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    return {
      inject: ['slots'],
      apply(ctx) {
        const doc = document.documentElement;
        doc.dataset.agentsRegisterSpikeMounted = String(Number(doc.dataset.agentsRegisterSpikeMounted ?? 0) + 1);
        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay', id: 'agents-register-marker',
        }, () => h('span', {
          'data-agents-register-overlay': '', 'aria-hidden': true, style: { display: 'none' },
        }, 'agents-register')));
      },
    };
  },
});
