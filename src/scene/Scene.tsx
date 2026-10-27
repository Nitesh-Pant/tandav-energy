import { CameraRig } from './Camera/CameraRig'
import { Halo } from './EnergyEffects/Halo'
import { RingOfFire } from './EnergyEffects/RingOfFire'
import { Shockwaves } from './EnergyEffects/Shockwaves'
import { Atmosphere } from './Environment/Atmosphere'
import { CosmicSea } from './Environment/CosmicSea'
import { FloatingRocks } from './Environment/FloatingRocks'
import { Lights } from './Environment/Lights'
import { Mountains } from './Environment/Mountains'
import { Pedestal } from './Environment/Pedestal'
import { Sky } from './Environment/Sky'
import { Stars } from './Environment/Stars'
import { Trident } from './Environment/Trident'
import { Meteors } from './Environment/Meteors'
import { Vortex } from './Environment/Vortex'
import { Lightning } from './Lightning/Lightning'
import { CosmicDust } from './Particles/CosmicDust'
import { Embers } from './Particles/Embers'
import { Sparks } from './Particles/Sparks'
import { PostFX } from './PostFX'
import { Shiva } from './Shiva/Shiva'
import { Statue } from './Shiva/Statue'

/** Composition root: background → middle ground → figure → effects → post. */
export function Scene() {
  return (
    <>
      <color attach="background" args={['#020309']} />
      <CameraRig />
      <Lights />

      <Sky />
      <Stars />
      <Meteors />
      <Vortex />
      <Mountains />
      <CosmicSea />
      <Atmosphere />

      <Halo />
      <RingOfFire />
      <Pedestal />
      <Trident />
      <Shiva />
      <Statue />
      <FloatingRocks />

      <Shockwaves />
      <Lightning />
      <CosmicDust />
      <Embers />
      <Sparks />

      <PostFX />
    </>
  )
}
