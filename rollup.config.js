import buble from 'rollup-plugin-buble';
import filesize from 'rollup-plugin-filesize';
import typescript from 'rollup-plugin-typescript';

export default {
	entry: 'src/index.ts',
	dest: 'build/instantclick.js',
	format: 'umd',
	moduleName: 'InstantClick',
	plugins: [
		typescript(),
		buble({ transforms: { dangerousForOf: true } }),
		filesize()
	]
};
