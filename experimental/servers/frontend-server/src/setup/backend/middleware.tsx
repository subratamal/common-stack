import * as React from 'react';
import * as ReactDOMServer from 'react-dom/server';
import { ApolloProvider, getDataFromTree } from 'react-apollo';
import { addApolloLogging } from 'apollo-logger';
import { addPersistedQueries } from 'persistgraphql';
import { Html } from '../ssr/html';
import { Component } from '../../components';
import Helmet from 'react-helmet';
import * as path from 'path';
import * as fs from 'fs';
const { renderToMarkup } = require('fela-dom');
import { Provider as ReduxProvider } from 'react-redux';
import { logger } from '@common-stack/utils';
import { createApolloClient } from '../apollo-client';
import * as ReactFela from 'react-fela';
import createRenderer from './felaRenderer';
import { SETTINGS } from '../../config';
import { createReduxStore } from '../../redux-config';
import publicEnv from '../../config/public-config';

let assetMap;
async function renderServerSide(req, res) {
    try {
        const client = createApolloClient();

        let initialState = {};
        const store = createReduxStore();
        const renderer = createRenderer();
        const component = (
            <ReduxProvider store={store} >
                <ApolloProvider client={client}>
                    <ReactFela.Provider renderer={renderer} >
                        <Component />
                    </ReactFela.Provider>
                </ApolloProvider>
            </ReduxProvider>
        );

        const appCss = renderToMarkup(renderer);
        await getDataFromTree(component);
        res.status(200);


        const html = ReactDOMServer.renderToString(component);


        const helmet = Helmet.renderStatic(); // Avoid memory leak while tracking mounted instances

        if (__DEV__ || !assetMap) {
            assetMap = JSON.parse(fs.readFileSync(path.join(SETTINGS.frontendBuildDir, 'web', 'assets.json')).toString());
        }
        const apolloState = Object.assign({}, client.extract());
        const env = {
            ...publicEnv,
        };

        const page = (
            <Html
                content={html}
                state={apolloState}
                assetMap={assetMap}
                helmet={helmet}
                css={appCss}
                env={env}
            />
        );
        res.send(`<!doctype html>\n${ReactDOMServer.renderToStaticMarkup(page)}`);
        res.end();
    } catch (err) {
        logger.error('SERVER SIDE RENDER failed due to (%j) ', err.message);
        logger.debug(err);
    }
}
export const websiteMiddleware = async (req, res, next) => {
    try {
        if (req.url.indexOf('.') < 0 && __SSR__) {
            return renderServerSide(req, res);
        } else {
            return next();
        }
    } catch (e) {
        logger.error('RENDERING ERROR:', e);
        return next(e);
    }
};
