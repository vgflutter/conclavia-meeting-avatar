import {SPEECH_SAMPLE_RATE} from '@conclavia/avatar-kit/speech';
/** Existing TG container writer, shared by its server adapters. PCM playback
 * and alignment remain owned by the avatar kit. */
export function wave(pcm:Buffer){
 const h=Buffer.alloc(44);h.write('RIFF');h.writeUInt32LE(pcm.length+36,4);h.write('WAVEfmt ',8);h.writeUInt32LE(16,16);h.writeUInt16LE(1,20);h.writeUInt16LE(1,22);h.writeUInt32LE(SPEECH_SAMPLE_RATE,24);h.writeUInt32LE(SPEECH_SAMPLE_RATE*2,28);h.writeUInt16LE(2,32);h.writeUInt16LE(16,34);h.write('data',36);h.writeUInt32LE(pcm.length,40);return Buffer.concat([h,pcm]);
}
