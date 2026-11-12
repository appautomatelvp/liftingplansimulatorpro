# Target architecture

```mermaid
flowchart TB
  subgraph ui [UI]
    HTML[index.html]
    Controllers[src/ui/controllers]
    Layout[ui-layout]
  end
  subgraph app [Application]
    Boot[src/app/boot]
    Services[src/ui/services]
  end
  subgraph domain [Domain]
    CargoDom[domain/cargo]
    RigDom[domain/rigging]
    CraneDom[domain/crane]
    SiteDom[domain/site]
    Standards[domain/standards]
  end
  subgraph physics [Physics]
    Orchestrator[sim/physics step]
    Contacts[contacts/hoist/cables]
  end
  subgraph render [Rendering]
    GFX[src/graphics]
    Scene[sim/scene]
  end
  subgraph assets [Assets]
    Library[sim/library]
    CAEAssets[core AssetPipeline]
  end
  HTML --> Controllers
  Controllers --> Services
  Services --> Boot
  Boot --> domain
  Boot --> Orchestrator
  Orchestrator --> Contacts
  Boot --> Scene
  Scene --> GFX
  Library --> CAEAssets
  Standards --> CAEStandards[core/standards]
```

## Layer rules

| Layer | May depend on |
|-------|----------------|
| UI controllers | app services, shared events |
| App | domain, physics ports, shared |
| Domain | shared only (pure) |
| Physics | domain types, shared |
| Rendering | shared, domain read-models |
| Assets | shared, graphics |

## Runtime object (post–Phase 1)

`createRuntime()` owns `state`, `phy`, scene handles, and an `events` bus. Modules export `install(runtime)` instead of relying on lexical concat.
