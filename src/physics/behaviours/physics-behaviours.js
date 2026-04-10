/**
 * Physics-Based Behaviours for Nemosyne
 * 
 * A suite of behaviours that leverage Ammo.js physics simulation
 * for realistic interactions, collisions, and dynamics.
 * 
 * @author Nemosyne Framework
 * @version 0.2.0
 * @requires Ammo.js, AmmoPhysicsEngine
 */

/**
 * Base class for physics behaviours
 */
class PhysicsBehaviour {
  constructor(entity, physicsEngine, config) {
    this.entity = entity;
    this.physics = physicsEngine;
    this.config = config;
    this.active = true;
  }
  
  attach() {
    throw new Error('attach() must be implemented by subclass');
  }
  
  detach() {
    this.active = false;
  }
  
  // Get body from entity
  getBody() {
    const nodeId = this.entity.dataset?.nodeId || this.entity.id;
    return this.physics?.nodeBodies?.get(nodeId);
  }
}

/**
 * Collision behaviour - triggers actions on physics collision
 */
class CollisionBehaviour extends PhysicsBehaviour {
  attach() {
    const body = this.getBody();
    if (!body) return;
    
    // Set up collision callback
    body.addEventListener = (event, callback) => {
      if (event === 'collision') {
        this.collisionCallback = callback;
      }
    };
    
    // Override contact processing
    const originalUpdate = body.update;
    body.update = () => {
      originalUpdate.call(body);
      
      // Check contacts
      const numManifolds = this.physics.world.getDispatcher().getNumManifolds();
      for (let i = 0; i < numManifolds; i++) {
        const manifold = this.physics.world.getDispatcher().getManifoldByIndexInternal(i);
        if (manifold.getBody0() === body || manifold.getBody1() === body) {
          const numContacts = manifold.getNumContacts();
          if (numContacts > 0) {
            // Collision detected
            const otherBody = manifold.getBody0() === body ? manifold.getBody1() : manifold.getBody0();
            if (this.collisionCallback) {
              this.collisionCallback({
                otherBody: otherBody,
                contactPoints: numContacts,
                impulse: manifold.getContactPoint(0).getAppliedImpulse()
              });
            }
          }
        }
      }
    };
  }
}

/**
 * Gravity behaviour - applies custom gravity field
 */
class GravityBehaviour extends PhysicsBehaviour {
  attach() {
    if (!this.physics) return;
    
    const center = this.config.center || { x: 0, y: 0, z: 0 };
    const strength = this.config.strength || 10;
    const radius = this.config.radius || Infinity;
    
    // Add to physics update loop
    const originalStep = this.physics.stepSimulation.bind(this.physics);
    this.physics.stepSimulation = (deltaTime) => {
      this.applyGravity(center, strength, radius);
      originalStep(deltaTime);
    };
  }
  
  applyGravity(center, strength, radius) {
    const A = this.physics.ammo;
    
    this.physics.nodeBodies.forEach((body, nodeId) = {
      const pos = body.getWorldTransform().getOrigin();
      
      const dx = center.x - pos.x();
      const dy = center.y - pos.y();
      const dz = center.z - pos.z();
      const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
      
      if (radius !== Infinity && dist > radius) return;
      
      // F = G * m / r²
      const force = strength / (dist * dist + 0.01);
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      const fz = (dz / dist) * force;
      
      body.applyCentralForce(new A.btVector3(fx, fy, fz));
    });
  }
}

/**
 * Explosion behaviour - applies outward force from point
 */
class ExplosionBehaviour extends PhysicsBehaviour {
  trigger(explosionPoint, force) {
    const A = this.physics.ammo;
    
    this.physics.nodeBodies.forEach((body, nodeId) => {
      const pos = body.getWorldTransform().getOrigin();
      
      const dx = pos.x() - explosionPoint.x;
      const dy = pos.y() - explosionPoint.y;
      const dz = pos.z() - explosionPoint.z;
      const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
      
      if (dist < 0.01) return; // Skip center
      
      // Force falls off with distance
      const magnitude = force / (dist * dist + 1);
      const fx = (dx / dist) * magnitude;
      const fy = (dy / dist) * magnitude;
      const fz = (dz / dist) * magnitude;
      
      body.applyCentralImpulse(new A.btVector3(fx, fy, fz));
      body.activate(); // Wake up
    });
  }
}

/**
 * Magnetic behaviour - attracts/repels based on polarity
 */
class MagneticBehaviour extends PhysicsBehaviour {
  attach() {
    const polarity = this.config.polarity || 1; // 1 = positive, -1 = negative
    const strength = this.config.strength || 50;
    
    // Store polarity on body
    const body = this.getBody();
    if (body) {
      body.polarity = polarity;
      body.magneticStrength = strength;
    }
    
    // Add to physics loop
    const originalStep = this.physics.stepSimulation.bind(this.physics);
    this.physics.stepSimulation = (deltaTime) => {
      this.applyMagneticForces();
      originalStep(deltaTime);
    };
  }
  
  applyMagneticForces() {
    const A = this.physics.ammo;
    const bodies = Array.from(this.physics.nodeBodies.values());
    
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const bodyA = bodies[i];
        const bodyB = bodies[j];
        
        if (!bodyA.polarity || !bodyB.polarity) continue;
        
        const posA = bodyA.getWorldTransform().getOrigin();
        const posB = bodyB.getWorldTransform().getOrigin();
        
        const dx = posB.x() - posA.x();
        const dy = posB.y() - posA.y();
        const dz = posB.z() - posA.z();
        const dist = Math.sqrt(dx*dx + dy*dy + dz*dz) + 0.01;
        
        // Like poles repel, opposite attract
        const samePolarity = bodyA.polarity === bodyB.polarity;
        const direction = samePolarity ? -1 : 1;
        
        const force = (direction * bodyA.magneticStrength * bodyB.magneticStrength) / (dist * dist);
        
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        const fz = (dz / dist) * force;
        
        bodyA.applyCentralForce(new A.btVector3(fx, fy, fz));
        bodyB.applyCentralForce(new A.btVector3(-fx, -fy, -fz));
      }
    }
  }
}

/**
 * Wind behaviour - applies directional force
 */
class WindBehaviour extends PhysicsBehaviour {
  attach() {
    this.direction = this.normalize(this.config.direction || { x: 1, y: 0, z: 0 });
    this.strength = this.config.strength || 5;
    this.turbulence = this.config.turbulence || 0.2;
    this.interval = this.config.interval || 100;
    
    // Apply wind periodically
    this.windInterval = setInterval(() => this.applyWind(), this.interval);
  }
  
  applyWind() {
    const A = this.physics.ammo;
    
    this.physics.nodeBodies.forEach((body, nodeId) => {
      // Add turbulence
      const turbulence = {
        x: (Math.random() - 0.5) * this.turbulence,
        y: (Math.random() - 0.5) * this.turbulence,
        z: (Math.random() - 0.5) * this.turbulence
      };
      
      const force = new A.btVector3(
        (this.direction.x + turbulence.x) * this.strength,
        (this.direction.y + turbulence.y) * this.strength,
        (this.direction.z + turbulence.z) * this.strength
      );
      
      body.applyCentralForce(force);
      body.activate();
    });
  }
  
  normalize(v) {
    const len = Math.sqrt(v.x*v.x + v.y*v.y + v.z*v.z);
    return len > 0 ? { x: v.x/len, y: v.y/len, z: v.z/len } : v;
  }
  
  detach() {
    super.detach();
    clearInterval(this.windInterval);
  }
}

/**
 * Buoyancy behaviour - simulates floating in fluid
 */
class BuoyancyBehaviour extends PhysicsBehaviour {
  attach() {
    this.fluidLevel = this.config.fluidLevel || 0;
    this.density = this.config.density || 1.0; // Fluid density
    this.dragCoefficient = this.config.drag || 0.5;
    
    // Add to physics loop
    const originalStep = this.physics.stepSimulation.bind(this.physics);
    this.physics.stepSimulation = (deltaTime) => {
      this.applyBuoyancy();
      originalStep(deltaTime);
    };
  }
  
  applyBuoyancy() {
    const A = this.physics.ammo;
    
    this.physics.nodeBodies.forEach((body, nodeId) => {
      const pos = body.getWorldTransform().getOrigin();
      
      // Check if below fluid level
      if (pos.y() > this.fluidLevel) return;
      
      // Calculate submerged volume (simple approximation)
      const depth = this.fluidLevel - pos.y();
      const submergedVolume = Math.min(depth, 1.0); // Clamp at 100%
      
      // Buoyancy force: F = ρ * V * g
      const buoyancyForce = this.density * submergedVolume * 9.81;
      
      // Apply upward force
      body.applyCentralForce(new A.btVector3(0, buoyancyForce, 0));
      
      // Apply drag
      const velocity = body.getLinearVelocity();
      const dragForce = new A.btVector3(
        -velocity.x() * this.dragCoefficient,
        -velocity.y() * this.dragCoefficient,
        -velocity.z() * this.dragCoefficient
      );
      body.applyCentralForce(dragForce);
    });
  }
}

/**
 * Spring Network behaviour - creates interconnected spring system
 */
class SpringNetworkBehaviour extends PhysicsBehaviour {
  attach() {
    this.restLength = this.config.restLength || 2.0;
    this.stiffness = this.config.stiffness || 0.5;
    this.damping = this.config.damping || 0.3;
    
    // Initialize springs between all pairs
    this.initializeSprings();
    
    // Add to physics loop
    const originalStep = this.physics.stepSimulation.bind(this.physics);
    this.physics.stepSimulation = (deltaTime) => {
      this.applySpringForces();
      originalStep(deltaTime);
    };
  }
  
  initializeSprings() {
    const bodies = Array.from(this.physics.nodeBodies.values());
    this.springs = [];
    
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        this.springs.push({
          bodyA: bodies[i],
          bodyB: bodies[j],
          restLength: this.restLength
        });
      }
    }
  }
  
  applySpringForces() {
    const A = this.physics.ammo;
    
    this.springs.forEach(spring => {
      const posA = spring.bodyA.getWorldTransform().getOrigin();
      const posB = spring.bodyB.getWorldTransform().getOrigin();
      
      const dx = posB.x() - posA.x();
      const dy = posB.y() - posA.y();
      const dz = posB.z() - posA.z();
      const dist = Math.sqrt(dx*dx + dy*dy + dz*dz) + 0.01;
      
      // Spring force: F = k * (L - L₀)
      const displacement = dist - spring.restLength;
      const force = this.stiffness * displacement;
      
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      const fz = (dz / dist) * force;
      
      spring.bodyA.applyCentralForce(new A.btVector3(fx, fy, fz));
      spring.bodyB.applyCentralForce(new A.btVector3(-fx, -fy, -fz));
    });
  }
}

/**
 * Vortex behaviour - creates swirling motion
 */
class VortexBehaviour extends PhysicsBehaviour {
  attach() {
    this.center = this.config.center || { x: 0, y: 0, z: 0 };
    this.axis = this.normalize(this.config.axis || { x: 0, y: 1, z: 0 });
    this.strength = this.config.strength || 10;
    this.radius = this.config.radius || 5;
    
    // Add to physics loop
    const originalStep = this.physics.stepSimulation.bind(this.physics);
    this.physics.stepSimulation = (deltaTime) => {
      this.applyVortexForces();
      originalStep(deltaTime);
    };
  }
  
  applyVortexForces() {
    const A = this.physics.ammo;
    
    this.physics.nodeBodies.forEach((body, nodeId) => {
      const pos = body.getWorldTransform().getOrigin();
      
      // Vector from center to position
      const dx = pos.x() - this.center.x;
      const dy = pos.y() - this.center.y;
      const dz = pos.z() - this.center.z;
      
      // Project onto plane perpendicular to axis
      const dot = dx*this.axis.x + dy*this.axis.y + dz*this.axis.z;
      const rx = dx - dot*this.axis.x;
      const ry = dy - dot*this.axis.y;
      const rz = dz - dot*this.axis.z;
      const r = Math.sqrt(rx*rx + ry*ry + rz*rz);
      
      if (r < 0.01) return;
      
      // Tangent vector (cross product of axis and radial)
      const tx = this.axis.y * rz - this.axis.z * ry;
      const ty = this.axis.z * rx - this.axis.x * rz;
      const tz = this.axis.x * ry - this.axis.y * rx;
      
      // Force proportional to 1/r
      const magnitude = this.strength / (r + 0.1);
      const fx = (tx / r) * magnitude;
      const fy = (ty / r) * magnitude;
      const fz = (tz / r) * magnitude;
      
      body.applyCentralForce(new A.btVector3(fx, fy, fz));
    });
  }
  
  normalize(v) {
    const len = Math.sqrt(v.x*v.x + v.y*v.y + v.z*v.z);
    return len > 0 ? { x: v.x/len, y: v.y/len, z: v.z/len } : v;
  }
}

/**
 * Particle System behaviour - emits physics-based particles
 */
class ParticleSystemBehaviour extends PhysicsBehaviour {
  attach() {
    this.emissionRate = this.config.emissionRate || 10; // particles per second
    this.lifetime = this.config.lifetime || 2000; // ms
    this.velocity = this.config.velocity || { x: 0, y: 1, z: 0 };
    this.spread = this.config.spread || 0.5;
    
    this.particles = [];
    this.emissionInterval = setInterval(() => this.emitParticle(), 1000 / this.emissionRate);
  }
  
  emitParticle() {
    const A = this.physics.ammo;
    
    const particle = {
      body: this.physics.createNodeBody(`particle-${Date.now()}`, {
        x: this.entity.getAttribute('position').x + (Math.random() - 0.5) * 0.1,
        y: this.entity.getAttribute('position').y,
        z: this.entity.getAttribute('position').z + (Math.random() - 0.5) * 0.1
      }, {
        mass: 0.1,
        radius: 0.05
      }),
      created: Date.now()
    };
    
    // Initial velocity
    const velocity = new A.btVector3(
      this.velocity.x + (Math.random() - 0.5) * this.spread,
      this.velocity.y + (Math.random() - 0.5) * this.spread,
      this.velocity.z + (Math.random() - 0.5) * this.spread
    );
    
    particle.body.setLinearVelocity(velocity);
    
    this.particles.push(particle);
    
    // Cleanup old particles
    this.cleanupParticles();
  }
  
  cleanupParticles() {
    const now = Date.now();
    this.particles = this.particles.filter(p => {
      if (now - p.created > this.lifetime) {
        this.physics.removeBody(p.body.nodeId);
        return false;
      }
      return true;
    });
  }
  
  detach() {
    super.detach();
    clearInterval(this.emissionInterval);
    this.particles.forEach(p => this.physics.removeBody(p.body.nodeId));
  }
}

// Export behaviour classes
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PhysicsBehaviour,
    CollisionBehaviour,
    GravityBehaviour,
    ExplosionBehaviour,
    MagneticBehaviour,
    WindBehaviour,
    BuoyancyBehaviour,
    SpringNetworkBehaviour,
    VortexBehaviour,
    ParticleSystemBehaviour
  };
}

console.log('[PhysicsBehaviours] 10 physics behaviours loaded');