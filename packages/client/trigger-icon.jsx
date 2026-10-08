import React,{useLayoutEffect,useRef} from 'react';

/** Decorate the synthetic ZCode trigger bubbles in the official Chat view.
 *
 * The driver marks its automation-wake user messages with `source.zcodeTrigger`
 * (an extra source field the official format tolerates). The chat renders user
 * rows through the keyed slot 'conversation.chat.node' (key 'user'), which a
 * plugin may shadow at a lower priority; the shadow is a pure pass-through of
 * the official component, plus one absolutely positioned refresh glyph pinned
 * to the marked bubble's left edge, vertically centred on it.
 *
 * The official user row is a right-aligned column whose box is wider than the
 * bubble (the time/actions row below extends it), so flow placement cannot hug
 * the bubble; measuring the bubble box and pinning the glyph is the only
 * layout-stable option short of re-implementing the official view.
 *
 * The slot is declared by ui-chat's own registration, whose load time this
 * package must not depend on: registration waits for the official 'user' entry
 * via the slots change subscription instead of a boot-graph edge.
 */

/** Pin the glyph to the bubble's left edge, vertically centred on it. */
function usePinnedGlyph(rowRef,glyphRef){
  useLayoutEffect(()=>{
    const row=rowRef.current,glyph=glyphRef.current;
    if(!row||!glyph)return;
    const bubbleOf=()=>row.querySelector('[class*="bubble"]')??row.firstElementChild?.firstElementChild??null;
    // The glyph is a fixed 14×14 svg; SVG elements expose no offsetWidth, so any
    // size read there yields NaN and the style write is silently ignored.
    const place=()=>{
      const bubble=bubbleOf();
      if(!bubble){glyph.style.visibility='hidden';return}
      const base=row.getBoundingClientRect(),box=bubble.getBoundingClientRect();
      glyph.style.visibility='';
      glyph.style.left=`${Math.max(0,box.left-base.left-20)}px`;
      glyph.style.top=`${box.top-base.top+(box.height-14)/2}px`;
    };
    place();
    const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(place);
    const bubble=bubbleOf();
    if(observer&&bubble)observer.observe(bubble);
    return ()=>{observer?.disconnect()};
  });
}

/** Shadow the official 'user' chat renderer: pass-through, plus a pinned glyph on triggers. */
export function TriggerUserMessage({node,children}){
  const rowRef=useRef(null),glyphRef=useRef(null);
  usePinnedGlyph(rowRef,glyphRef);
  // The official component arrives as `children`, keeping this wrapper
  // independent of ui-chat internals and props drift.
  if(node?.data?.source?.zcodeTrigger!==true)return children;
  return <div data-zcode-trigger-row ref={rowRef} style={{position:'relative',width:'100%'}}>
    {children}
    <svg ref={glyphRef} data-zcode-trigger-glyph width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"
      style={{position:'absolute',color:'var(--dsw-static-neutral-bluish-600,#81858c)'}}>
      <path d="M13.5 8A5.5 5.5 0 1 1 11.9 4.1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M13.9 1.6v3h-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </div>;
}

/** Capture the official 'user' entry (once it exists) and register the shadow. */
export function installTriggerIcon(ctx){
  const KEY='conversation.chat.node';
  ctx.effect(()=>{
    let dispose;
    const attempt=()=>{
      if(dispose)return true;
      // Entries read empty while the slot is undeclared, so this doubles as the
      // "chat plugin not loaded yet" guard.
      const entries=ctx.slots.entries(KEY);
      const official=entries.find(entry=>entry.options?.key==='user');
      // React.memo components are objects, not functions: accept any non-null component.
      if(official?.component==null)return false;
      // Same locale namespace as the official entry so the framework synthesizes
      // the identical `t` seat for the passthrough child.
      const Wrapper=props=>React.createElement(TriggerUserMessage,{node:props.node},
        React.createElement(official.component,props));
      dispose=ctx.slots.register({name:KEY,key:'user',priority:-10,locale:'chat',registrant:'zcode-trigger-icon'},Wrapper);
      return true;
    };
    if(!attempt()){
      // Fires both on the slot's declaration and on entry registrations.
      const unsubscribe=ctx.slots.subscribe(KEY,()=>{if(attempt())unsubscribe()});
      return ()=>{unsubscribe();dispose?.()};
    }
    return ()=>{dispose?.()};
  },'zcode-bridge: trigger icon');
}
