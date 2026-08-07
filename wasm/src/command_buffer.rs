use std::sync::Mutex;

pub const MAGIC: u32 = 0x4E454D4F; // "NEMO" in ASCII
pub const VERSION: u16 = 1;

pub const OP_CREATE_NODE: u8 = 0x01;
pub const OP_UPDATE_TRANSFORM: u8 = 0x02;
pub const OP_DESTROY_NODE: u8 = 0x03;
pub const OP_SET_COLOR: u8 = 0x04;
pub const OP_UPDATE_INSTANCES: u8 = 0x05;

pub struct CommandBuffer {
    buffer: Vec<u8>,
    cmd_count: u16,
}

impl CommandBuffer {
    pub fn new() -> Self {
        let mut cb = CommandBuffer {
            buffer: Vec::with_capacity(4096),
            cmd_count: 0,
        };
        cb.reset();
        cb
    }

    pub fn reset(&mut self) {
        self.buffer.clear();
        self.cmd_count = 0;
        // Header: Magic (4 bytes), Version (2 bytes), Command Count (2 bytes)
        self.buffer.extend_from_slice(&MAGIC.to_le_bytes());
        self.buffer.extend_from_slice(&VERSION.to_le_bytes());
        self.buffer.extend_from_slice(&0u16.to_le_bytes());
    }

    pub fn push_create_node(&mut self, entity: u32, geometry_type: u8, material_type: u8, flags: u16) {
        self.buffer.push(OP_CREATE_NODE);
        self.buffer.extend_from_slice(&entity.to_le_bytes());
        self.buffer.push(geometry_type);
        self.buffer.push(material_type);
        self.buffer.extend_from_slice(&flags.to_le_bytes());
        self.cmd_count += 1;
        self.update_count_header();
    }

    pub fn push_update_transform(&mut self, entity: u32, pos: [f32; 3], rot: [f32; 4], scale: [f32; 3]) {
        self.buffer.push(OP_UPDATE_TRANSFORM);
        self.buffer.extend_from_slice(&entity.to_le_bytes());
        for p in pos {
            self.buffer.extend_from_slice(&p.to_le_bytes());
        }
        for r in rot {
            self.buffer.extend_from_slice(&r.to_le_bytes());
        }
        for s in scale {
            self.buffer.extend_from_slice(&s.to_le_bytes());
        }
        self.cmd_count += 1;
        self.update_count_header();
    }

    pub fn push_destroy_node(&mut self, entity: u32) {
        self.buffer.push(OP_DESTROY_NODE);
        self.buffer.extend_from_slice(&entity.to_le_bytes());
        self.cmd_count += 1;
        self.update_count_header();
    }

    pub fn push_set_color(&mut self, entity: u32, color: [f32; 4]) {
        self.buffer.push(OP_SET_COLOR);
        self.buffer.extend_from_slice(&entity.to_le_bytes());
        for c in color {
            self.buffer.extend_from_slice(&c.to_le_bytes());
        }
        self.cmd_count += 1;
        self.update_count_header();
    }

    pub fn push_update_instances(&mut self, entity: u32, instance_count: u32, data_offset: u32) {
        self.buffer.push(OP_UPDATE_INSTANCES);
        self.buffer.extend_from_slice(&entity.to_le_bytes());
        self.buffer.extend_from_slice(&instance_count.to_le_bytes());
        self.buffer.extend_from_slice(&data_offset.to_le_bytes());
        self.cmd_count += 1;
        self.update_count_header();
    }

    fn update_count_header(&mut self) {
        if self.buffer.len() >= 8 {
            let bytes = self.cmd_count.to_le_bytes();
            self.buffer[6] = bytes[0];
            self.buffer[7] = bytes[1];
        }
    }

    pub fn bytes(&self) -> &[u8] {
        &self.buffer
    }
}

static GLOBAL_COMMAND_BUFFER: Mutex<Option<CommandBuffer>> = Mutex::new(None);

pub fn with_global_buffer<F, R>(f: F) -> R
where
    F: FnOnce(&mut CommandBuffer) -> R,
{
    let mut guard = GLOBAL_COMMAND_BUFFER.lock().expect("global command buffer lock");
    if guard.is_none() {
        *guard = Some(CommandBuffer::new());
    }
    f(guard.as_mut().unwrap())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn command_buffer_encodes_header_and_ops() {
        let mut cb = CommandBuffer::new();
        assert_eq!(cb.bytes().len(), 8);

        cb.push_create_node(42, 1, 2, 0);
        cb.push_update_transform(42, [1.0, 2.0, 3.0], [0.0, 0.0, 0.0, 1.0], [1.0, 1.0, 1.0]);

        let bytes = cb.bytes();
        assert_eq!(&bytes[0..4], &MAGIC.to_le_bytes());
        assert_eq!(&bytes[4..6], &VERSION.to_le_bytes());
        assert_eq!(&bytes[6..8], &2u16.to_le_bytes()); // 2 commands
    }
}
