
import * as React from 'react';
import * as renderer from 'react-test-renderer';
import gql from 'graphql-tag';

import ApolloClient from 'apollo-client';
import { ApolloError } from 'apollo-client/errors';

declare function require(name: string);

import mockNetworkInterface from '../../../mocks/mockNetworkInterface';
import {
  // Passthrough,
  ProviderMock,
} from '../../../mocks/components';

import graphql from '../../../../src/graphql';

describe('queries', () => {

  it('binds a query to props', () => {
    const query = gql`query people { allPeople(first: 1) { people { name } } }`;
    const data = { allPeople: { people: [ { name: 'Luke Skywalker' } ] } };
    const networkInterface = mockNetworkInterface({ request: { query }, result: { data } });
    const client = new ApolloClient({ networkInterface });

    const ContainerWithData = graphql(query)(({ data }) => { // tslint:disable-line
      expect(data).toBeTruthy();
      expect(data.ownProps).toBeFalsy();
      expect(data.loading).toBe(true);
      return null;
    });

    const output = renderer.create(<ProviderMock client={client}><ContainerWithData /></ProviderMock>);
    output.unmount();
  });

  it('includes the variables in the props', () => {
    const query = gql`query people ($first: Int) { allPeople(first: $first) { people { name } } }`;
    const data = { allPeople: { people: [ { name: 'Luke Skywalker' } ] } };
    const variables = { first: 1 };
    const networkInterface = mockNetworkInterface(
      { request: { query, variables }, result: { data } }
    );
    const client = new ApolloClient({ networkInterface });

    const ContainerWithData =  graphql(query)(({ data }) => { // tslint:disable-line
      expect(data).toBeTruthy();;
      expect(data.variables).toEqual(variables);
      return null;
    });

    renderer.create(<ProviderMock client={client}><ContainerWithData first={1} /></ProviderMock>);
  });

  it('does not swallow children errors', () => {
    const query = gql`query people { allPeople(first: 1) { people { name } } }`;
    const data = { allPeople: { people: [ { name: 'Luke Skywalker' } ] } };
    const networkInterface = mockNetworkInterface({ request: { query }, result: { data } });
    const client = new ApolloClient({ networkInterface });
    let bar;
    const ContainerWithData =  graphql(query)(() => {
      bar(); // this will throw
      return null;
    });

    try {
      renderer.create(<ProviderMock client={client}><ContainerWithData /></ProviderMock>);
      throw new Error();
    } catch (e) {
      expect(e.name).toMatch(/TypeError/);
    }

  });

  it('executes a query', (done) => {
    const query = gql`query people { allPeople(first: 1) { people { name } } }`;
    const data = { allPeople: { people: [ { name: 'Luke Skywalker' } ] } };
    const networkInterface = mockNetworkInterface({ request: { query }, result: { data } });
    const client = new ApolloClient({ networkInterface });

    @graphql(query)
    class Container extends React.Component<any, any> {
      componentWillReceiveProps(props) {
        expect(props.data.loading).toBe(false);
        expect(props.data.allPeople).toEqual(data.allPeople);
        done();
      }
      render() {
        return null;
      }
    };

    renderer.create(<ProviderMock client={client}><Container /></ProviderMock>);
  });

  // XXX reinsert `queries-2.test.tsx` after react 15.4

  it('correctly sets loading state on component with changed variables and unchanged result', (done) => {
     const query = gql`
       query remount($first: Int) { allPeople(first: $first) { people { name } } }
     `;
     const data = { allPeople: null };
     const variables = { first: 1 };
     const variables2 = { first: 2 };
     const networkInterface = mockNetworkInterface(
       { request: { query, variables }, result: { data }, delay: 10 },
       { request: { query, variables: variables2 }, result: { data }, delay: 10 }
     );
     const client = new ApolloClient({ networkInterface });
     let count = 0;

     const connect = (component) : any => {
       return class Container extends React.Component<any, any> {
         constructor(props) {
           super(props);

           this.state = {
             first: 1,
           };
           this.setFirst = this.setFirst.bind(this);
         }

         setFirst(first) {
           this.setState({first});
         }

         render() {
           return React.createElement(component, {
             first: this.state.first,
             setFirst: this.setFirst
           });
         }
       }
     }

     @connect
     @graphql(query, { options: ({ first }) => ({ variables: { first }})})
     class Container extends React.Component<any, any> {
       componentWillReceiveProps(props) {
         if (count === 0) { // has data
           setTimeout(() => {
             this.props.setFirst(2);
           }, 5);
         }

         if (count === 1) {
           expect(this.props.data.loading).toBe(true); // on variables change
         }

         if (count === 2) {
           // new data after fetch
           expect(props.data.loading).toBe(false);
           done();
         }
         count++;
       }
       render() {
         return null;
       }
     };

     renderer.create(<ProviderMock client={client}><Container /></ProviderMock>);
   });

  it('executes a query with two root fields', (done) => {
    const query = gql`query people {
      allPeople(first: 1) { people { name } }
      otherPeople(first: 1) { people { name } }
    }`;
    const data = {
      allPeople: { people: [ { name: 'Luke Skywalker' } ] },
      otherPeople: { people: [ { name: 'Luke Skywalker' } ] },
    };
    const networkInterface = mockNetworkInterface({ request: { query }, result: { data } });
    const client = new ApolloClient({ networkInterface });

    @graphql(query)
    class Container extends React.Component<any, any> {
      componentWillReceiveProps(props) {
        expect(props.data.loading).toBe(false);
        expect(props.data.allPeople).toEqual(data.allPeople);
        expect(props.data.otherPeople).toEqual(data.otherPeople);
        done();
      }
      render() {
        return null;
      }
    };

    renderer.create(<ProviderMock client={client}><Container /></ProviderMock>);
  });

  it('can unmount without error', (done) => {
    const query = gql`query people { allPeople(first: 1) { people { name } } }`;
    const data = { allPeople: { people: [ { name: 'Luke Skywalker' } ] } };
    const networkInterface = mockNetworkInterface({ request: { query }, result: { data } });
    const client = new ApolloClient({ networkInterface });

    const ContainerWithData =  graphql(query)(() => null);

    const wrapper = renderer.create(
      <ProviderMock client={client}><ContainerWithData /></ProviderMock>
    ) as any;

    try {
      wrapper.unmount();
      done();
    } catch (e) { throw new Error(e); }
  });

  it('passes any GraphQL errors in props', (done) => {
    const query = gql`query people { allPeople(first: 1) { people { name } } }`;
    const networkInterface = mockNetworkInterface({ request: { query }, error: new Error('boo') });
    const client = new ApolloClient({ networkInterface });

    @graphql(query)
    class ErrorContainer extends React.Component<any, any> {
      componentWillReceiveProps({ data }) { // tslint:disable-line
        expect(data.error).toBeTruthy();;
        expect(data.error instanceof ApolloError).toBe(true);
        done();
      }
      render() {
        return null;
      }
    };

    renderer.create(<ProviderMock client={client}><ErrorContainer /></ProviderMock>);
  });

  it('maps props as variables if they match', (done) => {
    const query = gql`
      query people($first: Int) {
        allPeople(first: $first) { people { name } }
      }
    `;
    const data = { allPeople: { people: [ { name: 'Luke Skywalker' } ] } };
    const variables = { first: 1 };
    const networkInterface = mockNetworkInterface({
      request: { query, variables },
      result: { data },
    });
    const client = new ApolloClient({ networkInterface });

    @graphql(query)
    class Container extends React.Component<any, any> {
      componentWillReceiveProps(props) {
        expect(props.data.loading).toBe(false);
        expect(props.data.allPeople).toEqual(data.allPeople);
        expect(props.data.variables).toEqual(this.props.data.variables);
        done();
      }
      render() {
        return null;
      }
    };

    renderer.create(<ProviderMock client={client}><Container first={1} /></ProviderMock>);
  });

  it('allows falsy values in the mapped variables from props', (done) => {
    const query = gql`
      query people($first: Int) {
        allPeople(first: $first) { people { name } }
      }
    `;
    const data = { allPeople: { people: [ { name: 'Luke Skywalker' } ] } };
    const variables = { first: null };
    const networkInterface = mockNetworkInterface({
      request: { query, variables },
      result: { data },
    });
    const client = new ApolloClient({ networkInterface });

    @graphql(query)
    class Container extends React.Component<any, any> {
      componentWillReceiveProps(props) {
        expect(props.data.loading).toBe(false);
        expect(props.data.allPeople).toEqual(data.allPeople);
        done();
      }
      render() {
        return null;
      }
    };

    renderer.create(<ProviderMock client={client}><Container first={null} /></ProviderMock>);
  });

  it('don\'t error on optional required props', () => {
    const query = gql`
      query people($first: Int) {
        allPeople(first: $first) { people { name } }
      }
    `;
    const data = { allPeople: { people: [ { name: 'Luke Skywalker' } ] } };
    const variables = { first: 1 };
    const networkInterface = mockNetworkInterface({
      request: { query, variables },
      result: { data },
    });
    const client = new ApolloClient({ networkInterface });
    const Container =  graphql(query)(() => null);

    let error = null;
    try {
      renderer.create(<ProviderMock client={client}><Container frst={1} /></ProviderMock>);
    } catch (e) { error = e; }

    expect(error).toBeNull();

  });

  it('errors if the passed props don\'t contain the needed variables', () => {
    const query = gql`
      query people($first: Int!) {
        allPeople(first: $first) { people { name } }
      }
    `;
    const data = { allPeople: { people: [ { name: 'Luke Skywalker' } ] } };
    const variables = { first: 1 };
    const networkInterface = mockNetworkInterface({
      request: { query, variables },
      result: { data },
    });
    const client = new ApolloClient({ networkInterface });
    const Container =  graphql(query)(() => null);

    try {
      renderer.create(<ProviderMock client={client}><Container frst={1} /></ProviderMock>);
    } catch (e) {
      expect(e.name).toMatch(/Invariant Violation/);
      expect(e.message).toMatch(/The operation 'people'/);
    }

  });

  it('rebuilds the queries on prop change when using `options`', (done) => {
    const query = gql`query people { allPeople(first: 1) { people { name } } }`;
    const data = { allPeople: { people: [ { name: 'Luke Skywalker' } ] } };
    const networkInterface = mockNetworkInterface({ request: { query }, result: { data } });
    const client = new ApolloClient({ networkInterface });


    let firstRun = true;
    let isDone = false;
    function options(props) {
      if (!firstRun) {
        expect(props.listId).toBe(2);
        if (!isDone) done();
        isDone = true;
      }
      return {};
    };

    const Container = graphql(query, { options })((props) => null);

    class ChangingProps extends React.Component<any, any> {
      state = { listId: 1 };

      componentDidMount() {
        setTimeout(() => {
          firstRun = false;
          this.setState({ listId: 2 });
        }, 50);
      }

      render() {
        return <Container listId={this.state.listId} />;
      }
    }

    renderer.create(<ProviderMock client={client}><ChangingProps /></ProviderMock>);
  });

  it('allows you to skip a query', (done) => {
    const query = gql`query people { allPeople(first: 1) { people { name } } }`;
    const data = { allPeople: { people: [ { name: 'Luke Skywalker' } ] } };
    const networkInterface = mockNetworkInterface({ request: { query }, result: { data } });
    const client = new ApolloClient({ networkInterface });

    let queryExecuted;
    @graphql(query, { options: () => ({ skip: true }) })
    class Container extends React.Component<any, any> {
      componentWillReceiveProps(props) {
        queryExecuted = true;
      }
      render() {
        expect(this.props.data.loading).toBe(false);
        return null;
      }
    };

    renderer.create(<ProviderMock client={client}><Container /></ProviderMock>);

    setTimeout(() => {
      if (!queryExecuted) { done(); return; }
      done(new Error('query ran even though skip present'));
    }, 25);
  });

  it('reruns the query if it changes', (done) => {
    let count = 0;
    const query = gql`
      query people($first: Int) {
        allPeople(first: $first) { people { name } }
      }
    `;

    const data1 = { allPeople: { people: [ { name: 'Luke Skywalker' } ] } };
    const variables1 = { first: 1 };

    const data2 = { allPeople: { people: [ { name: 'Leia Skywalker' } ] } };
    const variables2 = { first: 2 };

    const networkInterface = mockNetworkInterface(
      { request: { query, variables: variables1 }, result: { data: data1 } },
      { request: { query, variables: variables2 }, result: { data: data2 } }
    );

    const client = new ApolloClient({ networkInterface });

    @graphql(query, {
      options: (props) => ({ variables: props, returnPartialData: count === 0 }),
    })
    class Container extends React.Component<any, any> {
      componentWillReceiveProps({ data }) {
        // loading is true, but data still there
        if (count === 1 && data.loading) {
          expect(data.allPeople).toEqual(data1.allPeople);
        }
        if (count === 1 && !data.loading && this.props.data.loading) {
          expect(data.allPeople).toEqual(data2.allPeople);
          done();
        }
      }
      render() {
        return null;
      }
    };

    class ChangingProps extends React.Component<any, any> {
      state = { first: 1 };

      componentDidMount() {
        setTimeout(() => {
          count++;
          this.setState({ first: 2 });
        }, 50);
      }

      render() {
        return <Container first={this.state.first} />;
      }
    }

    renderer.create(<ProviderMock client={client}><ChangingProps /></ProviderMock>);
  });

  it('reruns the query if just the variables change', (done) => {
    let count = 0;
    const query = gql`
      query people($first: Int) {
        allPeople(first: $first) { people { name } }
      }
    `;

    const data1 = { allPeople: { people: [ { name: 'Luke Skywalker' } ] } };
    const variables1 = { first: 1 };

    const data2 = { allPeople: { people: [ { name: 'Leia Skywalker' } ] } };
    const variables2 = { first: 2 };

    const networkInterface = mockNetworkInterface(
      { request: { query, variables: variables1 }, result: { data: data1 } },
      { request: { query, variables: variables2 }, result: { data: data2 } }
    );

    const client = new ApolloClient({ networkInterface });

    @graphql(query, { options: (props) => ({ variables: props }) })
    class Container extends React.Component<any, any> {
      componentWillReceiveProps({ data }) {
        // loading is true, but data still there
        if (count === 1 && data.loading) {
          expect(data.allPeople).toEqual(data1.allPeople);
        }
        if (count === 1 && !data.loading && this.props.data.loading) {
          expect(data.allPeople).toEqual(data2.allPeople);
          done();
        }
      }
      render() {
        return null;
      }
    };

    class ChangingProps extends React.Component<any, any> {
      state = { first: 1 };

      componentDidMount() {
        setTimeout(() => {
          count++;
          this.setState({ first: 2 });
        }, 50);
      }

      render() {
        return <Container first={this.state.first} />;
      }
    }

    renderer.create(<ProviderMock client={client}><ChangingProps /></ProviderMock>);
  });

  it('reruns the queries on prop change when using passed props', (done) => {
    let count = 0;
    const query = gql`
      query people($first: Int) {
        allPeople(first: $first) { people { name } }
      }
    `;

    const data1 = { allPeople: { people: [ { name: 'Luke Skywalker' } ] } };
    const variables1 = { first: 1 };

    const data2 = { allPeople: { people: [ { name: 'Leia Skywalker' } ] } };
    const variables2 = { first: 2 };

    const networkInterface = mockNetworkInterface(
      { request: { query, variables: variables1 }, result: { data: data1 } },
      { request: { query, variables: variables2 }, result: { data: data2 } }
    );

    const client = new ApolloClient({ networkInterface });

    @graphql(query)
    class Container extends React.Component<any, any> {
      componentWillReceiveProps({ data }) {
        // loading is true, but data still there
        if (count === 1 && data.loading) {
          expect(data.allPeople).toEqual(data1.allPeople);
        }
        if (count === 1 && !data.loading && this.props.data.loading) {
          expect(data.allPeople).toEqual(data2.allPeople);
          done();
        }
      }
      render() {
        return null;
      }
    };

    class ChangingProps extends React.Component<any, any> {
      state = { first: 1 };

      componentDidMount() {
        setTimeout(() => {
          count++;
          this.setState({ first: 2 });
        }, 50);
      }

      render() {
        return <Container first={this.state.first} />;
      }
    }

    renderer.create(<ProviderMock client={client}><ChangingProps /></ProviderMock>);
  });

  it('exposes refetch as part of the props api', (done) => {
    const query = gql`query people($first: Int) { allPeople(first: $first) { people { name } } }`;
    const variables = { first: 1 };
    const data1 = { allPeople: { people: [ { name: 'Luke Skywalker' } ] } };
    const networkInterface = mockNetworkInterface(
      { request: { query, variables }, result: { data: data1 } },
      { request: { query, variables }, result: { data: data1 } },
      { request: { query, variables: { first: 2 } }, result: { data: data1 } }
    );
    const client = new ApolloClient({ networkInterface });

    let hasRefetched, count = 0;
    @graphql(query)
    class Container extends React.Component<any, any> {
      componentWillMount(){
        expect(this.props.data.refetch).toBeTruthy();
        expect(this.props.data.refetch instanceof Function).toBe(true);
      }
      componentWillReceiveProps({ data }) { // tslint:disable-line
        if (count === 0) expect(data.loading).toBe(false); // first data
        if (count === 1) expect(data.loading).toBe(true); // first refetch
        if (count === 2) expect(data.loading).toBe(false); // second data
        if (count === 3) expect(data.loading).toBe(true); // second refetch
        if (count === 4) expect(data.loading).toBe(false); // third data
        count ++;
        if (hasRefetched) return;
        hasRefetched = true;
        expect(data.refetch).toBeTruthy();
        expect(data.refetch instanceof Function).toBe(true);
        data.refetch()
          .then(result => {
            expect(result.data).toEqual(data1);
            data.refetch({ first: 2 }) // new variables
              .then(response => {
                expect(response.data).toEqual(data1);
                expect(data.allPeople).toEqual(data1.allPeople);
                done();
              });
          })
          .catch(done);
      }
      render() {
        return null;
      }
    };

    renderer.create(<ProviderMock client={client}><Container first={1} /></ProviderMock>);
  });

  it('exposes fetchMore as part of the props api', (done) => {
    const query = gql`
      query people($skip: Int, $first: Int) { allPeople(first: $first, skip: $skip) { people { name } } }
    `;
    const data = { allPeople: { people: [ { name: 'Luke Skywalker' } ] } };
    const data1 = { allPeople: { people: [ { name: 'Leia Skywalker' } ] } };
    const variables = { skip: 1, first: 1 };
    const variables2 = { skip: 2, first: 1 };

    const networkInterface = mockNetworkInterface(
      { request: { query, variables }, result: { data } },
      { request: { query, variables: variables2 }, result: { data: data1 } }
    );
    const client = new ApolloClient({ networkInterface });

    let count = 0;
    @graphql(query, { options: () => ({ variables }) })
    class Container extends React.Component<any, any> {
      componentWillMount(){
        expect(this.props.data.fetchMore).toBeTruthy();
        expect(this.props.data.fetchMore instanceof Function).toBe(true);
      }
      componentWillReceiveProps(props) {
        if (count === 0) {
          expect(props.data.fetchMore).toBeTruthy();
          expect(props.data.fetchMore instanceof Function).toBe(true);
          props.data.fetchMore({
            variables: { skip: 2 },
            updateQuery: (prev, { fetchMoreResult }) => ({
              allPeople: {
                people: prev.allPeople.people.concat(fetchMoreResult.data.allPeople.people),
              },
            }),
          });
          // XXX add a test for the result here when #508 is merged and released
        } else if (count === 1) {
          expect(props.data.variables).toEqual(variables2);
          expect(props.data.loading).toBe(true);
          expect(props.data.allPeople).toEqual(data.allPeople);
        } else if (count === 2) {
          expect(props.data.variables).toEqual(variables2);
          expect(props.data.loading).toBe(false);
          expect(props.data.allPeople.people).toEqual(
            data.allPeople.people.concat(data1.allPeople.people)
          );
          done();
        } else {
          throw new Error('should not reach this point');
        }
        count++;
      }
      render() {
        return null;
      }
    };

    renderer.create(<ProviderMock client={client}><Container /></ProviderMock>);
  });

  it('exposes stopPolling as part of the props api', (done) => {
    const query = gql`query people { allPeople(first: 1) { people { name } } }`;
    const data = { allPeople: { people: [ { name: 'Luke Skywalker' } ] } };
    const networkInterface = mockNetworkInterface({ request: { query }, result: { data } });
    const client = new ApolloClient({ networkInterface });

    @graphql(query)
    class Container extends React.Component<any, any> {
      componentWillReceiveProps({ data }) { // tslint:disable-line
        expect(data.stopPolling).toBeTruthy();
        expect(data.stopPolling instanceof Function).toBe(true);
        expect(data.stopPolling).not.toThrow();
        done();
      }
      render() {
        return null;
      }
    };

    renderer.create(<ProviderMock client={client}><Container /></ProviderMock>);
  });

  it('exposes startPolling as part of the props api', (done) => {
    const query = gql`query people { allPeople(first: 1) { people { name } } }`;
    const data = { allPeople: { people: [ { name: 'Luke Skywalker' } ] } };
    const networkInterface = mockNetworkInterface({ request: { query }, result: { data } });
    const client = new ApolloClient({ networkInterface });

    // @graphql(query)
    @graphql(query, { options: { pollInterval: 10 }})
    class Container extends React.Component<any, any> {
      componentWillReceiveProps({ data }) { // tslint:disable-line
        expect(data.startPolling).toBeTruthy();
        expect(data.startPolling instanceof Function).toBe(true);
        // XXX this does throw because of no pollInterval
        // expect(data.startPolling).not.toThrow();
        done();
      }
      render() {
        return null;
      }
    };

    renderer.create(<ProviderMock client={client}><Container /></ProviderMock>);
  });


  it('resets the loading state after a refetched query', (done) => {
    const query = gql`query people { allPeople(first: 1) { people { name } } }`;
    const data = { allPeople: { people: [ { name: 'Luke Skywalker' } ] } };
    const data2 = { allPeople: { people: [ { name: 'Leia Skywalker' } ] } };
    const networkInterface = mockNetworkInterface(
      { request: { query }, result: { data } },
      { request: { query }, result: { data: data2 } }
    );
    const client = new ApolloClient({ networkInterface });

    let isRefectching;
    let refetched;
    @graphql(query)
    class Container extends React.Component<any, any> {
      componentWillReceiveProps(props) {
        // get new data with no more loading state
        if (refetched) {
          expect(props.data.loading).toBe(false);
          expect(props.data.allPeople).toEqual(data2.allPeople);
          done();
          return;
        }

        // don't remove old data
        if (isRefectching) {
          isRefectching = false;
          refetched = true;
          expect(props.data.loading).toBe(true);
          expect(props.data.allPeople).toEqual(data.allPeople);
          return;
        }

        if (!isRefectching) {
          isRefectching = true;
          props.data.refetch();
        }
      }
      render() {
        return null;
      }
    };

    renderer.create(<ProviderMock client={client}><Container /></ProviderMock>);
  });

  it('resets the loading state after a refetched query even if the data doesn\'t change', (d) => {
    const query = gql`query people { allPeople(first: 1) { people { name } } }`;
    const data = { allPeople: { people: [ { name: 'Luke Skywalker' } ] } };
    const networkInterface = mockNetworkInterface(
      { request: { query }, result: { data } },
      { request: { query }, result: { data } }
    );
    const client = new ApolloClient({ networkInterface });

    let isRefectching;
    let refetched;
    @graphql(query)
    class Container extends React.Component<any, any> {
      componentWillReceiveProps(props) {
        // get new data with no more loading state
        if (refetched) {
          expect(props.data.loading).toBe(false);
          expect(props.data.allPeople).toEqual(data.allPeople);
          d();
          return;
        }

        // don't remove old data
        if (isRefectching) {
          isRefectching = false;
          refetched = true;
          expect(props.data.loading).toBe(true);
          expect(props.data.allPeople).toEqual(data.allPeople);
          return;
        }

        if (!isRefectching) {
          isRefectching = true;
          props.data.refetch();
        }
      }
      render() {
        return null;
      }
    };

    renderer.create(<ProviderMock client={client}><Container /></ProviderMock>);
  });

  it('allows a polling query to be created', (done) => {
    const query = gql`query people { allPeople(first: 1) { people { name } } }`;
    const data = { allPeople: { people: [ { name: 'Luke Skywalker' } ] } };
    const data2 = { allPeople: { people: [ { name: 'Leia Skywalker' } ] } };
    const networkInterface = mockNetworkInterface(
      { request: { query }, result: { data } },
      { request: { query }, result: { data: data2 } },
      { request: { query }, result: { data: data2 } }
    );
    const client = new ApolloClient({ networkInterface });

    let count = 0;
    const Container = graphql(query, { options: () => ({ pollInterval: 75 }) })(() => {
      count++;
      return null;
    });

    const wrapper = renderer.create(<ProviderMock client={client}><Container /></ProviderMock>);

    setTimeout(() => {
      expect(count).toBe(3);
      (wrapper as any).unmount();
      done();
    }, 160);
  });

  it('allows custom mapping of a result to props', () => {
    const query = gql`query thing { getThing { thing } }`;
    const data = { getThing: { thing: true } };
    const networkInterface = mockNetworkInterface({ request: { query }, result: { data } });
    const client = new ApolloClient({ networkInterface });

    const props = ({ data }) => ({ showSpinner: data.loading });
    const ContainerWithData = graphql(query, { props })(({ showSpinner }) => {
      expect(showSpinner).toBe(true);
      return null;
    });

    const wrapper = renderer.create(<ProviderMock client={client}><ContainerWithData /></ProviderMock>);
    (wrapper as any).unmount();
  });

  it('allows custom mapping of a result to props that includes the passed props', () => {
    const query = gql`query thing { getThing { thing } }`;
    const data = { getThing: { thing: true } };
    const networkInterface = mockNetworkInterface({ request: { query }, result: { data } });
    const client = new ApolloClient({ networkInterface });

    const props = ({ data, ownProps }) => {
      expect(ownProps.sample).toBe(1);
      return { showSpinner: data.loading };
    };
    const ContainerWithData = graphql(query, { props })(({ showSpinner }) => {
      expect(showSpinner).toBe(true);
      return null;
    });

    const wrapper = renderer.create(
      <ProviderMock client={client}><ContainerWithData sample={1} /></ProviderMock>
    );
    (wrapper as any).unmount();
  });

  it('allows custom mapping of a result to props', (done) => {
    const query = gql`query thing { getThing { thing } }`;
    const data = { getThing: { thing: true } };
    const networkInterface = mockNetworkInterface({ request: { query }, result: { data } });
    const client = new ApolloClient({ networkInterface });

    @graphql(query, { props: ({ data }) => ({ thingy: data.getThing }) }) // tslint:disable-line
    class Container extends React.Component<any, any> {
      componentWillReceiveProps(props) {
        expect(props.thingy).toEqual(data.getThing);
        done();
      }
      render() {
        return null;
      }
    };

    renderer.create(<ProviderMock client={client}><Container /></ProviderMock>);
  });

  it('allows context through updates', (done) => {
    const query = gql`query people { allPeople(first: 1) { people { name } } }`;
    const data = { allPeople: { people: [ { name: 'Luke Skywalker' } ] } };
    const networkInterface = mockNetworkInterface({ request: { query }, result: { data } });
    const client = new ApolloClient({ networkInterface });

    @graphql(query)
    class Container extends React.Component<any, any> {
      componentWillReceiveProps(props) {
        expect(props.data.loading).toBe(false);
        expect(props.data.allPeople).toEqual(data.allPeople);
      }
      render() {
        return <div>{this.props.children}</div>;
      }
    };

    class ContextContainer extends React.Component<any, any> {

      constructor(props) {
        super(props);
        this.state = { color: 'purple' };
      }

      getChildContext() {
        return { color: this.state.color };
      }

      componentDidMount() {
        setTimeout(() => {
          this.setState({ color: 'green' });
        }, 50);
      }

      render() {
        return <div>{this.props.children}</div>;
      }
    }

    (ContextContainer as any).childContextTypes = {
      color: React.PropTypes.string,
    };

    let count = 0;
    class ChildContextContainer extends React.Component<any, any> {
      render() {
        const { color } = (this.context as any);
        if (count === 0) expect(color).toBe('purple');
        if (count === 1) {
          expect(color).toBe('green');
          done();
        }

        count++;
        return <div>{this.props.children}</div>;
      }
    }

    (ChildContextContainer as any).contextTypes = {
      color: React.PropTypes.string,
    };

    renderer.create(
      <ProviderMock client={client}>
        <ContextContainer>
          <Container>
            <ChildContextContainer />
          </Container>
        </ContextContainer>
      </ProviderMock>);
  });

  it('exposes updateQuery as part of the props api', (done) => {
    const query = gql`query people { allPeople(first: 1) { people { name } } }`;
    const data = { allPeople: { people: [ { name: 'Luke Skywalker' } ] } };
    const networkInterface = mockNetworkInterface({ request: { query }, result: { data } });
    const client = new ApolloClient({ networkInterface });

    @graphql(query)
    class Container extends React.Component<any, any> {
      componentWillReceiveProps({ data }) { // tslint:disable-line
        expect(data.updateQuery).toBeTruthy();
        expect(data.updateQuery instanceof Function).toBe(true);
        try {
          data.updateQuery(() => done());
        } catch (error) {
          // fail
        }
      }
      render() {
        return null;
      }
    };

    renderer.create(<ProviderMock client={client}><Container /></ProviderMock>);
  });

  it('exposes updateQuery as part of the props api during componentWillMount', (done) => {
    const query = gql`query people { allPeople(first: 1) { people { name } } }`;
    const data = { allPeople: { people: [ { name: 'Luke Skywalker' } ] } };
    const networkInterface = mockNetworkInterface({ request: { query }, result: { data } });
    const client = new ApolloClient({ networkInterface });

    @graphql(query)
    class Container extends React.Component<any, any> {
      componentWillMount() { // tslint:disable-line
        expect(this.props.data.updateQuery).toBeTruthy()
        expect(this.props.data.updateQuery instanceof Function).toBe(true);
        done();
      }
      render() {
        return null;
      }
    };

    renderer.create(<ProviderMock client={client}><Container /></ProviderMock>);
  });

  it('updateQuery throws if called before data has returned', (done) => {
    const query = gql`query people { allPeople(first: 1) { people { name } } }`;
    const data = { allPeople: { people: [ { name: 'Luke Skywalker' } ] } };
    const networkInterface = mockNetworkInterface({ request: { query }, result: { data } });
    const client = new ApolloClient({ networkInterface });

    @graphql(query)
    class Container extends React.Component<any, any> {
      componentWillMount() { // tslint:disable-line
        expect(this.props.data.updateQuery).toBeTruthy();
        expect(this.props.data.updateQuery instanceof Function).toBe(true);
        try {
          this.props.data.updateQuery();
          done();
        } catch (e) {
          expect(e.message).toMatch(/Update query has been called before query has been created/);
          done();
        }
      }
      render() {
        return null;
      }
    };

    renderer.create(<ProviderMock client={client}><Container /></ProviderMock>);
  });

  it('allows updating query results after query has finished (early binding)', (done) => {
    const query = gql`query people { allPeople(first: 1) { people { name } } }`;
    const data = { allPeople: { people: [ { name: 'Luke Skywalker' } ] } };
    const data2 = { allPeople: { people: [ { name: 'Leia Skywalker' } ] } };
    const networkInterface = mockNetworkInterface(
      { request: { query }, result: { data } },
      { request: { query }, result: { data: data2 } }
    );
    const client = new ApolloClient({ networkInterface });

    let isUpdated;
    @graphql(query)
    class Container extends React.Component<any, any> {
      public updateQuery: any;
      componentWillMount() {
        this.updateQuery = this.props.data.updateQuery;
      }
      componentWillReceiveProps(props) {
        if (isUpdated) {
          expect(props.data.allPeople).toEqual(data2.allPeople);
          done();
          return;
        } else {
          isUpdated = true;
          this.updateQuery((prev) => {
            return data2;
          });
        }
      }
      render() {
        return null;
      }
    };

    renderer.create(<ProviderMock client={client}><Container /></ProviderMock>);
  });

  it('allows updating query results after query has finished', (done) => {
    const query = gql`query people { allPeople(first: 1) { people { name } } }`;
    const data = { allPeople: { people: [ { name: 'Luke Skywalker' } ] } };
    const data2 = { allPeople: { people: [ { name: 'Leia Skywalker' } ] } };
    const networkInterface = mockNetworkInterface(
      { request: { query }, result: { data } },
      { request: { query }, result: { data: data2 } }
    );
    const client = new ApolloClient({ networkInterface });

    let isUpdated;
    @graphql(query)
    class Container extends React.Component<any, any> {
      componentWillReceiveProps(props) {
        if (isUpdated) {
          expect(props.data.allPeople).toEqual(data2.allPeople);
          done();
          return;
        } else {
          isUpdated = true;
          props.data.updateQuery((prev) => {
            return data2;
          });
        }
      }
      render() {
        return null;
      }
    };

    renderer.create(<ProviderMock client={client}><Container /></ProviderMock>);
  });

  it('reruns props function after query results change via fetchMore', (done) => {
    const query = gql`query people($cursor: Int) {
      allPeople(cursor: $cursor) { cursor, people { name } }
    }`;
    const vars1 = { cursor: null };
    const data1 = { allPeople: { cursor: 1, people: [ { name: 'Luke Skywalker' } ] } };
    const vars2 = { cursor: 1 };
    const data2 = { allPeople: { cursor: 2, people: [ { name: 'Leia Skywalker' } ] } };
    const networkInterface = mockNetworkInterface(
      { request: { query, variables: vars1 }, result: { data: data1 } },
      { request: { query, variables: vars2 }, result: { data: data2 } }
    );
    const client = new ApolloClient({ networkInterface });

    let isUpdated = false;
    @graphql(query, {
      // XXX: I think we should be able to avoid this https://github.com/apollostack/react-apollo/issues/197
      options: { variables: { cursor: null } },
      props({ data: { loading, allPeople, fetchMore } }) {
        if (loading) return { loading };

        const { cursor, people } = allPeople;
        return {
          people,
          getMorePeople: () => fetchMore({
            variables: { cursor },
            updateQuery(prev, { fetchMoreResult }) {
              const { data: { allPeople: { cursor, people } } } = fetchMoreResult;
              return {
                allPeople: {
                  cursor,
                  people: [...people, ...prev.allPeople.people],
                },
              };
            }
          }),
        }
      }
    })
    class Container extends React.Component<any, any> {
      componentWillReceiveProps(props) {
        if (props.loading) {
          return;
        } else if (isUpdated) {
          expect(props.people.length).toBe(2);
          done();
          return;
        } else {
          isUpdated = true;
          expect(props.people).toEqual(data1.allPeople.people);
          props.getMorePeople();
        }
      }
      render() {
        return null;
      }
    };

    renderer.create(<ProviderMock client={client}><Container /></ProviderMock>);
  });
});
