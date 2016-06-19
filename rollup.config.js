import filesize from 'rollup-plugin-filesize';
import typescript from 'rollup-plugin-typescript';

export default {
	entry: 'src/index.ts',
	dest: 'build/instantclick.js',
	format: 'umd',
	moduleName: 'InstantClick',
	plugins: [
		typescript(),
		filesize()
	]
};
