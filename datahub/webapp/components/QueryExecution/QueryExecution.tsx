import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';

import { QueryExecutionStatus } from 'const/queryExecution';
import { useToggle } from 'hooks/useToggle';
import { sendNotification } from 'lib/dataHubUI';
import * as queryExecutionsActions from 'redux/queryExecutions/action';
import { IStoreState, Dispatch } from 'redux/store/types';
import {
    queryExecutionSelector,
    statementExecutionsSelector,
} from 'redux/queryExecutions/selector';

import { DataDocStatementExecutionBar } from 'components/DataDocStatementExecutionBar/DataDocStatementExecutionBar';
import { DataDocStatementExecution } from 'components/DataDocStatementExecution/DataDocStatementExecution';
import { StatementExecutionPicker } from 'components/ExecutionPicker/StatementExecutionPicker';
import { Loader } from 'ui/Loader/Loader';
import { Loading } from 'ui/Loading/Loading';

import { ExecutedQueryCell } from './ExecutedQueryCell';
import { QueryErrorWrapper } from './QueryError';
import { QuerySteps } from './QuerySteps';
import { QueryExecutionFooter } from './QueryExecutionFooter';
import './QueryExecution.scss';

interface IProps {
    id: number;
    docId?: number;
    changeCellContext?: (context: string) => any;
}

function useQueryExecutionReduxState(queryId: number) {
    // queryExecution: queryExecutionSelector(state, ownProps.id),
    //     statementExecutions: statementExecutionsSelector(state, ownProps.id),
    //     statementResultById: state.queryExecutions.statementResultById,

    const queryExecution = useSelector((state: IStoreState) =>
        queryExecutionSelector(state, queryId)
    );
    const statementExecutions = useSelector((state: IStoreState) =>
        statementExecutionsSelector(state, queryId)
    );
    const statementResultById = useSelector(
        (state: IStoreState) => state.queryExecutions.statementResultById
    );

    return {
        queryExecution,
        statementExecutions,
        statementResultById,
    };
}

function useQueryExecutionDispatch() {
    const dispatch: Dispatch = useDispatch();
    const loadQueryExecutionIfNeeded = useCallback(
        (queryExecutionId: number) => {
            dispatch(
                queryExecutionsActions.fetchQueryExecutionIfNeeded(
                    queryExecutionId
                )
            );
        },
        []
    );

    const pollQueryExecution = useCallback(
        (queryExecutionId: number, docId?: number) =>
            dispatch(
                queryExecutionsActions.pollQueryExecution(
                    queryExecutionId,
                    docId
                )
            ),
        []
    );

    const loadS3Result = useCallback(
        (statementExecutionId: number) =>
            dispatch(queryExecutionsActions.fetchResult(statementExecutionId)),
        []
    );

    const cancelQueryExecution = useCallback(
        (queryExecutionId: number) =>
            queryExecutionsActions
                .cancelQueryExecution(queryExecutionId)
                .then(() => {
                    sendNotification(
                        'Cancelled! Please be patient as the cancellation takes some time.'
                    );
                }),
        []
    );
    return {
        loadQueryExecutionIfNeeded,
        pollQueryExecution,
        loadS3Result,
        cancelQueryExecution,
    };
}

export const QueryExecution: React.FC<IProps> = ({
    id,
    docId,
    changeCellContext,
}) => {
    const [statementIndex, setStatementIndex] = useState(0);
    const [showExecutedQuery, setShowExecutedQuery] = useState(false);
    const [showStatementLogs, setShowStatementLogs] = useState(false);
    const [showStatementMeta, setShowStatementMeta] = useState(false);

    const {
        queryExecution,
        statementExecutions,
        statementResultById,
    } = useQueryExecutionReduxState(id);

    const statementExecution = useMemo(
        () => statementExecutions?.[statementIndex],
        [statementExecutions, statementIndex]
    );

    const {
        loadQueryExecutionIfNeeded,
        pollQueryExecution,
        loadS3Result,
        cancelQueryExecution,
    } = useQueryExecutionDispatch();

    const selectStatementId = useCallback(
        (statementId: number) => {
            const {
                statement_executions: statementExecutionIds,
            } = queryExecution;
            setStatementIndex(
                Math.max(statementExecutionIds.indexOf(statementId), 0)
            );
        },
        [queryExecution]
    );

    const toggleShowExecutedQuery = useToggle(setShowExecutedQuery);
    const toggleLogs = useToggle(setShowStatementLogs);
    const toggleShowStatementMeta = useToggle(setShowStatementMeta);

    useEffect(() => {
        if (
            queryExecution &&
            queryExecution.status <= QueryExecutionStatus.RUNNING
        ) {
            pollQueryExecution(queryExecution.id, docId);
        }
    }, [queryExecution]);

    const getQueryExecutionDOM = () => {
        const { statement_executions: statementExecutionIds } = queryExecution;
        const queryStepsDOM = <QuerySteps queryExecution={queryExecution} />;
        if (
            statementExecutionIds == null ||
            queryExecution.status === QueryExecutionStatus.INITIALIZED
        ) {
            return <div className="QueryExecution ">{queryStepsDOM}</div>;
        }
        const statementExecutionId = statementExecution
            ? statementExecution.id
            : null;
        const statementExecutionDOM = statementExecution ? (
            <DataDocStatementExecution
                key={statementExecutionId}
                statementExecution={statementExecution}
                statementResult={statementResultById[statementExecutionId]}
                showStatementMeta={showStatementMeta}
                loadS3Result={loadS3Result}
                showStatementLogs={showStatementLogs}
                toggleStatementMeta={toggleShowStatementMeta}
            />
        ) : queryExecution.status <= QueryExecutionStatus.RUNNING ? (
            <Loading />
        ) : null;

        const executedQueryDOM = showExecutedQuery ? (
            <ExecutedQueryCell
                queryExecution={queryExecution}
                highlightRange={
                    statementExecution && {
                        from: statementExecution.statement_range_start,
                        to: statementExecution.statement_range_end,
                    }
                }
                changeCellContext={changeCellContext}
            />
        ) : null;

        const footerDOM = getQueryExecutionFooterDOM();

        return (
            <div className="QueryExecution ">
                <div className="execution-wrapper">
                    {queryStepsDOM}
                    {getQueryExecutionErrorDOM()}
                    {getStatementExecutionHeaderDOM()}
                    {executedQueryDOM}
                    <div className="query-execution-content">
                        {statementExecutionDOM}
                    </div>

                    {footerDOM}
                </div>
            </div>
        );
    };

    const getStatementExecutionHeaderDOM = () => {
        const { id, status: queryStatus } = queryExecution;

        const statementExecutionBar = statementExecution ? (
            <DataDocStatementExecutionBar
                queryStatus={queryStatus}
                statementExecution={statementExecution}
                showStatementLogs={showStatementLogs}
                showExecutedQuery={showExecutedQuery}
                showStatementMeta={showStatementMeta}
                cancelQueryExecution={cancelQueryExecution.bind(null, id)}
                toggleShowExecutedQuery={toggleShowExecutedQuery}
                toggleLogs={toggleLogs}
                toggleShowStatementMeta={toggleShowStatementMeta}
            />
        ) : null;

        const statementTab = (
            <StatementExecutionPicker
                statementExecutionId={
                    statementExecution ? statementExecution.id : null
                }
                statementExecutions={statementExecutions}
                onSelection={selectStatementId}
                total={queryExecution.total}
                autoSelect
            />
        );

        return (
            <div className="statement-header">
                <div className="statement-header-top">
                    <div className="run-header-left">{statementTab}</div>
                </div>
                <div className="statement-header-bottom">
                    {statementExecutionBar}
                </div>
            </div>
        );
    };

    const getQueryExecutionErrorDOM = () => {
        if (queryExecution.status === QueryExecutionStatus.ERROR) {
            return (
                <QueryErrorWrapper
                    queryExecution={queryExecution}
                    statementExecutions={statementExecutions}
                />
            );
        }
    };

    const getQueryExecutionFooterDOM = () => {
        if (!queryExecution) {
            return;
        }

        return (
            <QueryExecutionFooter
                queryExecution={queryExecution}
                statementExecutions={statementExecutions}
            />
        );
    };

    return (
        <Loader
            item={queryExecution && queryExecution.statement_executions}
            itemKey={id}
            itemLoader={loadQueryExecutionIfNeeded.bind(null, id)}
            renderer={getQueryExecutionDOM}
        />
    );
};
